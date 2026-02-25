import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import RssParser from 'rss-parser';
import { PrismaService } from '../../database/prisma.service';
import { RssSource } from '../../config/news.config';
import { NewsService } from './news.service';

type CustomItem = {
  mediaThumbnail?: { $: { url: string } };
  mediaContent?: { $: { url: string; medium?: string } };
};

// Extracts first <img src="..."> from an HTML string (fallback for sites with no enclosure)
const IMG_SRC_RE = /<img[^>]+src=['"]([^'"]+)['"]/i;

@Injectable()
export class RssCrawlerService implements OnModuleInit {
  private readonly logger = new Logger(RssCrawlerService.name);
  private readonly parser: RssParser<Record<string, unknown>, CustomItem>;

  private categoryCache = new Map<string, string>(); // slug -> id
  private subcategoryCache = new Map<string, string>(); // slug -> id

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly newsService: NewsService,
  ) {
    this.parser = new RssParser<Record<string, unknown>, CustomItem>({
      customFields: {
        item: [
          ['media:thumbnail', 'mediaThumbnail'],
          ['media:content', 'mediaContent'],
        ],
      },
      timeout: 10000,
    });
  }

  async onModuleInit() {
    await this.refreshCache();
  }

  private async refreshCache() {
    const [categories, subcategories] = await Promise.all([
      this.prisma.newsCategory.findMany({ select: { id: true, slug: true } }),
      this.prisma.newsSubcategory.findMany({ select: { id: true, slug: true } }),
    ]);
    this.categoryCache = new Map(categories.map((c) => [c.slug, c.id]));
    this.subcategoryCache = new Map(subcategories.map((s) => [s.slug, s.id]));
    this.logger.debug(
      `Cache loaded: ${categories.length} categories, ${subcategories.length} subcategories`,
    );
  }

  async crawlAll(): Promise<{ created: number; updated: number; skipped: number }> {
    await this.refreshCache();
    const sources = this.configService.get<RssSource[]>('news.sources', []);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const source of sources) {
      try {
        const inputs = await this.crawlFeed(source);
        if (inputs.length === 0) continue;
        const result = await this.newsService.ingestMany(inputs);
        created += result.created;
        updated += result.updated;
        skipped += result.skipped;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Feed failed [${source.name} ${source.feedUrl}]: ${msg}`);
      }
    }

    return { created, updated, skipped };
  }

  private async crawlFeed(source: RssSource) {
    const feed = await this.parser.parseURL(source.feedUrl);
    const categoryId = this.categoryCache.get(source.categorySlug) ?? null;
    const subcategoryId = source.subcategorySlug
      ? (this.subcategoryCache.get(source.subcategorySlug) ?? null)
      : null;

    return (feed.items ?? [])
      .map((item) => ({
        sourceSite: source.name,
        categoryId: categoryId ?? undefined,
        subcategoryId: subcategoryId ?? undefined,
        guid: item.guid ?? undefined,
        url: (item.link ?? '').trim(),
        title: (item.title ?? '').trim(),
        publishedAt: item.isoDate ?? new Date().toISOString(),
        thumbnailUrl: this.extractThumbnail(item) ?? undefined,
        language: 'vi',
        summaryVi: (item.contentSnippet ?? '').trim() || undefined,
      }))
      .filter((i) => i.url && i.title);
  }

  private extractThumbnail(item: RssParser.Item & CustomItem): string | null {
    // 1. enclosure (VnExpress, Tuổi Trẻ, CafeBiz)
    if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url;
    }
    // 2. media:thumbnail
    if (item.mediaThumbnail?.$.url) {
      return item.mediaThumbnail.$.url;
    }
    // 3. media:content
    if (item.mediaContent?.$.url) {
      return item.mediaContent.$.url;
    }
    // 4. first <img src> in description HTML (Thanh Nien, Dan Tri)
    const html = (item as any).content ?? '';
    const match = IMG_SRC_RE.exec(html as string);
    return match?.[1] ?? null;
  }
}
