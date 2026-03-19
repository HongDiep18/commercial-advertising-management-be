import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { createHash } from 'crypto';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { VECTOR_STORE } from './vectorstore.provider';

const CrawlResponseSchema = z.object({
  markdown: z.string(),
  title: z.string(),
  success: z.boolean(),
});

const CRAWL_WHITELIST = [
  '/',
  '/about',
  '/directory',
  '/store',
  '/news',
  '/property',
  '/contact',
  '/login',
  '/register',
  '/forgot-password',
  '/set-password',
];


@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(VECTOR_STORE) private readonly vectorStore: PGVectorStore,
  ) {}

  async crawlAll(): Promise<{
    pagesProcessed: number;
    pagesSkipped: number;
    chunksUpserted: number;
  }> {
    const baseUrl = this.config.get<string>('chatbot.baseUrl');
    let pagesProcessed = 0;
    let pagesSkipped = 0;
    let chunksUpserted = 0;

    for (const path of CRAWL_WHITELIST) {
      const url = `${baseUrl}${path}`;
      try {
        const result = await this.crawlPage(url);
        if (!result) {
          pagesSkipped++;
          continue;
        }
        chunksUpserted += result.chunksUpserted;
        pagesProcessed++;
      } catch (err) {
        this.logger.error(`Failed to crawl ${url}`, (err as Error).stack);
      }
    }

    this.logger.log(
      `Crawl complete — processed: ${pagesProcessed}, skipped: ${pagesSkipped}, chunks: ${chunksUpserted}`,
    );
    return { pagesProcessed, pagesSkipped, chunksUpserted };
  }

  private async crawlPage(
    url: string,
  ): Promise<{ chunksUpserted: number } | null> {
    const crawl4aiUrl =
      this.config.get<string>('chatbot.crawl4aiUrl') ?? 'http://crawl4ai:11235';
    const sdkUrl = crawl4aiUrl.replace(':11235', ':11236');

    const maxAttempts = 3;
    let lastErr: Error | undefined;
    let response: Response | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        response = await fetch(`${sdkUrl}/crawl`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(30_000),
        });
        break;
      } catch (err) {
        lastErr = err as Error;
        const isTimeout =
          err instanceof DOMException && err.name === 'TimeoutError';
        if (isTimeout || attempt === maxAttempts) {
          throw new Error(
            isTimeout
              ? `Crawl SDK timed out after 30s for ${url}`
              : `Crawl SDK network error for ${url} after ${maxAttempts} attempts: ${lastErr.message}`,
          );
        }
        this.logger.warn(
          `[crawl] attempt ${attempt} failed for ${url}, retrying in ${200 * attempt}ms`,
        );
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }

    if (!response!.ok) {
      throw new Error(`Crawl SDK responded ${response!.status} for ${url}`);
    }

    let data: z.infer<typeof CrawlResponseSchema>;
    try {
      data = CrawlResponseSchema.parse(await response!.json());
    } catch (err) {
      throw new Error(
        `Crawl SDK returned unexpected response for ${url}: ${(err as Error).message}`,
      );
    }

    if (!data.success || !data.markdown) {
      this.logger.warn(`No content from crawl SDK for ${url}`);
      return null;
    }

    const rawMarkdown = data.markdown;

    if (!rawMarkdown?.trim()) {
      this.logger.warn(`Empty markdown from crawl SDK for ${url}`);
      return null;
    }

    const pageTitle = data.title || url;

    const markdown = rawMarkdown.trim();
    const newHash = createHash('sha256').update(markdown).digest('hex');

    // Check stored hash — skip if unchanged
    const existing = await this.prisma.crawledPage.findUnique({
      where: { sourceUrl: url },
      select: { contentHash: true },
    });

    if (existing?.contentHash === newHash) {
      this.logger.log(`skip (no changes): ${url}`);
      return null;
    }

    // Build and embed new chunks before touching stored data — keeps old chunks
    // live until the new ones are confirmed, so a transient embedding error
    // never leaves the page with an empty chunk set.
    const docs = await this.buildDocuments(markdown, url, pageTitle);
    const newIds = await this.vectorStore.addDocuments(docs);

    // New chunks are in the store — delete only the old ones by excluding the just-inserted IDs
    await this.prisma.$executeRaw`
      DELETE FROM document_chunks
      WHERE metadata->>'sourceUrl' = ${url}
        AND id != ALL(${newIds}::uuid[])
    `;

    await this.prisma.crawledPage.upsert({
      where: { sourceUrl: url },
      create: { sourceUrl: url, pageTitle, contentHash: newHash },
      update: { pageTitle, contentHash: newHash },
    });

    this.logger.log(`crawled: ${url} — ${docs.length} chunks`);
    return { chunksUpserted: docs.length };
  }

  private async buildDocuments(
    markdown: string,
    sourceUrl: string,
    pageTitle: string,
  ): Promise<Document[]> {
    this.logger.debug(
      `buildDocuments: ${sourceUrl} — markdown length: ${markdown.length}, preview: ${markdown.slice(0, 200).replace(/\n/g, '\\n')}`,
    );

    // Parse heading hierarchy and prepend breadcrumb to each section
    let sections = this.splitByHeadings(markdown);

    // Fallback: if no sections with content, treat entire markdown as one section
    if (sections.length === 0 && markdown.trim()) {
      sections = [{ headingPath: '', content: markdown }];
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 100,
    });

    const docs: Document[] = [];

    for (const section of sections) {
      const prefixedContent = `[Page: ${pageTitle}${section.headingPath ? ` > ${section.headingPath}` : ''}]\n${section.content}`;
      const chunks = await splitter.createDocuments([prefixedContent]);

      for (const chunk of chunks) {
        docs.push(
          new Document({
            pageContent: chunk.pageContent,
            metadata: {
              sourceUrl,
              pageTitle,
              headingPath: section.headingPath,
            },
          }),
        );
      }
    }

    return docs;
  }

  private splitByHeadings(
    markdown: string,
  ): { headingPath: string; content: string }[] {
    const lines = markdown.split('\n');
    const sections: { headingPath: string; content: string }[] = [];

    let h2 = '';
    let h3 = '';
    let buffer: string[] = [];

    const flush = () => {
      const text = buffer.join('\n').trim();
      if (text) {
        const parts = [h2, h3].filter(Boolean);
        sections.push({ headingPath: parts.join(' > '), content: text });
      }
      buffer = [];
    };

    for (const line of lines) {
      if (line.startsWith('## ')) {
        flush();
        h2 = line.replace(/^## /, '').trim();
        h3 = '';
      } else if (line.startsWith('### ')) {
        flush();
        h3 = line.replace(/^### /, '').trim();
      } else if (line.startsWith('# ')) {
        flush();
        h2 = '';
        h3 = '';
      } else {
        buffer.push(line);
      }
    }
    flush();

    return sections;
  }
}
