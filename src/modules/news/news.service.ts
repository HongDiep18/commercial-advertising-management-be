import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { NewsArticleStatus } from './enums/news-article-status.enum';

type IngestInput = {
  sourceSite: string;
  sourceCategory?: string;
  guid?: string;
  url: string;
  title: string;
  publishedAt: string;
  thumbnailUrl?: string;
  language?: string;
  contentText?: string;
  rawHtml?: string;
};

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingestMany(articles: IngestInput[]) {
    const normalized = articles
      .map((a) => ({
        ...a,
        url: a.url.trim(),
        guid: a.guid?.trim() || undefined,
        sourceSite: a.sourceSite.trim().toLowerCase(),
        sourceCategory: a.sourceCategory?.trim() || undefined,
        title: a.title.trim(),
      }))
      .filter((a) => a.url && a.sourceSite && a.title);

    if (normalized.length === 0) {
      return { created: 0, updated: 0, skipped: 0 };
    }

    const urls = [...new Set(normalized.map((a) => a.url))];
    const byUrlExisting = await this.prisma.newsArticle.findMany({
      where: { url: { in: urls } },
      select: {
        id: true,
        url: true,
        status: true,
        aiSummaryVi: true,
        aiSummaryZhTw: true,
        aiSummaryEn: true,
      },
    });
    const existingByUrl = new Map(byUrlExisting.map((a) => [a.url, a]));

    const guidPairs = normalized.filter((a) => a.guid);
    const byGuidExisting =
      guidPairs.length > 0
        ? await this.prisma.newsArticle.findMany({
            where: {
              OR: guidPairs.map((a) => ({
                sourceSite: a.sourceSite,
                guid: a.guid,
              })),
            },
            select: {
              id: true,
              url: true,
              sourceSite: true,
              guid: true,
              status: true,
              aiSummaryVi: true,
              aiSummaryZhTw: true,
              aiSummaryEn: true,
            },
          })
        : [];

    const existingByGuid = new Map(
      byGuidExisting.map((a) => [`${a.sourceSite}::${a.guid}`, a]),
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const input of normalized) {
      const existing =
        (input.guid
          ? existingByGuid.get(`${input.sourceSite}::${input.guid}`)
          : undefined) ?? existingByUrl.get(input.url);

      if (!existing) {
        await this.prisma.newsArticle.create({
          data: {
            sourceSite: input.sourceSite,
            sourceCategory: input.sourceCategory ?? null,
            guid: input.guid ?? null,
            url: input.url,
            title: input.title,
            publishedAt: new Date(input.publishedAt),
            thumbnailUrl: input.thumbnailUrl ?? null,
            language: input.language ?? 'vi',
            contentText: input.contentText ?? null,
            rawHtml: input.rawHtml ?? null,
            status: NewsArticleStatus.DRAFT,
          },
        });
        created += 1;
        continue;
      }

      const hasAllSummaries =
        !!existing.aiSummaryVi && !!existing.aiSummaryZhTw && !!existing.aiSummaryEn;
      const canUpdate =
        existing.status !== NewsArticleStatus.PUBLISHED || !hasAllSummaries;

      if (!canUpdate) {
        skipped += 1;
        continue;
      }

      await this.prisma.newsArticle.update({
        where: { id: existing.id },
        data: {
          sourceCategory: input.sourceCategory ?? null,
          guid: input.guid ?? null,
          url: input.url,
          title: input.title,
          publishedAt: new Date(input.publishedAt),
          thumbnailUrl: input.thumbnailUrl ?? null,
          language: input.language ?? 'vi',
          contentText: input.contentText ?? null,
          rawHtml: input.rawHtml ?? null,
        },
      });
      updated += 1;
    }

    return { created, updated, skipped };
  }

  async writeSummary(
    articleId: string,
    payload: {
      aiSummaryVi: string;
      aiSummaryZhTw: string;
      aiSummaryEn: string;
      aiModel?: string;
      tags?: string[];
      publish?: boolean;
    },
  ) {
    const article = await this.prisma.newsArticle.findUnique({
      where: { id: articleId },
      include: { tags: { include: { tag: true } } },
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const tagSlugs = (payload.tags ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    // Upsert tags and connect
    const tagConnections: { articleId: string; tagId: string }[] = [];
    if (tagSlugs.length > 0) {
      const uniqueSlugs = [...new Set(tagSlugs)];

      for (const slug of uniqueSlugs) {
        const tag = await this.prisma.newsTag.upsert({
          where: { slug },
          create: { slug, name: slug },
          update: {},
        });
        tagConnections.push({ articleId, tagId: tag.id });
      }

      // Remove old tag connections and add new ones
      await this.prisma.newsArticleTag.deleteMany({
        where: { articleId },
      });
      await this.prisma.newsArticleTag.createMany({
        data: tagConnections,
      });
    }

    const shouldPublish =
      typeof payload.publish === 'boolean' ? payload.publish : true;

    const updated = await this.prisma.newsArticle.update({
      where: { id: articleId },
      data: {
        aiSummaryVi: payload.aiSummaryVi,
        aiSummaryZhTw: payload.aiSummaryZhTw,
        aiSummaryEn: payload.aiSummaryEn,
        aiModel: payload.aiModel ?? null,
        summarizedAt: new Date(),
        ...(shouldPublish && { status: NewsArticleStatus.PUBLISHED }),
      },
      include: { tags: { include: { tag: true } } },
    });

    return updated;
  }

  async listPublished(page: number, limit: number) {
    const where = { status: NewsArticleStatus.PUBLISHED };

    const [data, total] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where,
        include: { tags: { include: { tag: true } } },
        orderBy: { publishedAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.newsArticle.count({ where }),
    ]);

    return new PaginatedResult(data, total, page, limit);
  }

  async getPublishedById(id: string) {
    const article = await this.prisma.newsArticle.findFirst({
      where: { id, status: NewsArticleStatus.PUBLISHED },
      include: { tags: { include: { tag: true } } },
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }
}
