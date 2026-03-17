import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { VECTOR_STORE } from './vectorstore.provider';

const CRAWL_WHITELIST = [
  '/',
  '/about',
  '/contact',
  '/login',
  '/register',
  '/directory',
  '/news',
  '/property',
  '/store',
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
        this.logger.error(`Failed to crawl ${url}: ${String(err)}`);
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

    const response = await fetch(`${sdkUrl}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Crawl SDK responded ${response.status} for ${url}`);
    }

    const data = (await response.json()) as {
      markdown: string;
      title: string;
      success: boolean;
    };

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

    // Delete old chunks for this URL then upsert new ones
    await this.prisma.$executeRaw`
      DELETE FROM document_chunks WHERE metadata->>'sourceUrl' = ${url}
    `;

    const docs = await this.buildDocuments(markdown, url, pageTitle);
    await this.vectorStore.addDocuments(docs);

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
