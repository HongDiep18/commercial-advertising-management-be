import { Injectable, NotFoundException } from '@nestjs/common';
import { NewsArticleStatus, Prisma } from '@prisma/client';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';

const isNotFound = (e: unknown) =>
  e instanceof Error && 'code' in e && e.code === 'P2025';

type IngestInput = {
  sourceSite: string;
  categoryId?: string;
  subcategoryId?: string;
  guid?: string;
  url: string;
  title: string;
  publishedAt: string;
  thumbnailUrl?: string;
  language?: string;
  summaryVi?: string;
};

const articleInclude = {
  category: true,
  subcategory: true,
} as const;

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
        summaryZhTw: true,
        summaryVi: true,
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
              summaryZhTw: true,
              summaryVi: true,
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
            categoryId: input.categoryId ?? null,
            subcategoryId: input.subcategoryId ?? null,
            guid: input.guid ?? null,
            url: input.url,
            title: input.title,
            publishedAt: new Date(input.publishedAt),
            thumbnailUrl: input.thumbnailUrl ?? null,
            language: input.language ?? 'vi',
            summaryVi: input.summaryVi ?? null,
            status: NewsArticleStatus.DRAFT,
          },
        });
        created += 1;
        continue;
      }

      // Skip if already published with translation, or if still DRAFT with summaryVi already set
      const canUpdate =
        existing.status === NewsArticleStatus.PUBLISHED
          ? !existing.summaryZhTw
          : !existing.summaryVi;

      if (!canUpdate) {
        skipped += 1;
        continue;
      }

      await this.prisma.newsArticle.update({
        where: { id: existing.id },
        data: {
          categoryId: input.categoryId ?? null,
          subcategoryId: input.subcategoryId ?? null,
          guid: input.guid ?? null,
          url: input.url,
          title: input.title,
          publishedAt: new Date(input.publishedAt),
          thumbnailUrl: input.thumbnailUrl ?? null,
          language: input.language ?? 'vi',
          summaryVi: input.summaryVi ?? null,
        },
      });
      updated += 1;
    }

    return { created, updated, skipped };
  }

  async writeSummary(
    articleId: string,
    payload: {
      titleVi: string;
      titleZhTw: string;
      titleEn: string;
      summaryVi: string;
      summaryZhTw: string;
      summaryEn: string;
    },
  ) {
    try {
      return await this.prisma.newsArticle.update({
        where: { id: articleId },
        data: {
          title: payload.titleVi,
          titleZhTw: payload.titleZhTw,
          titleEn: payload.titleEn,
          summaryVi: payload.summaryVi,
          summaryZhTw: payload.summaryZhTw,
          summaryEn: payload.summaryEn,
          status: NewsArticleStatus.PUBLISHED,
        },
        include: articleInclude,
      });
    } catch (e) {
      if (isNotFound(e)) throw new NotFoundException('Article not found');
      throw e;
    }
  }

  async listPublished(
    page: number,
    limit: number,
    filters: { categorySlugs?: string[]; subcategoryIds?: string[] } = {},
  ) {
    const categorySlugs = filters.categorySlugs
      ?.map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const subcategoryIds = filters.subcategoryIds?.filter(Boolean);

    const where: Prisma.NewsArticleWhereInput = {
      status: NewsArticleStatus.PUBLISHED,
      ...(categorySlugs?.length && {
        category: { slug: { in: categorySlugs } },
      }),
      ...(subcategoryIds?.length && { subcategoryId: { in: subcategoryIds } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where,
        include: articleInclude,
        orderBy: { publishedAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.newsArticle.count({ where }),
    ]);

    return new PaginatedResult(data, total, page, limit);
  }

  async listCategories() {
    return this.prisma.newsCategory.findMany({
      include: { subcategories: { orderBy: { nameEn: 'asc' } } },
      orderBy: { nameEn: 'asc' },
    });
  }

  async findDraftsPendingTranslation(limit: number) {
    return this.prisma.newsArticle.findMany({
      where: {
        status: NewsArticleStatus.DRAFT,
        summaryVi: { not: null },
        titleZhTw: null,
      },
      include: { category: true },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  async getPublishedById(id: string) {
    const article = await this.prisma.newsArticle.findFirst({
      where: { id, status: NewsArticleStatus.PUBLISHED },
      include: articleInclude,
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }
}
