import { Inject, Injectable, Logger } from '@nestjs/common';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { VECTOR_STORE } from './vectorstore.provider';
import { AD_CATEGORY_SELECT } from './graph/constants';

type AdCategoryWithPackages = Prisma.AdPackageCategoryGetPayload<{
  select: typeof AD_CATEGORY_SELECT;
}>;

@Injectable()
export class ContextRetrievalService {
  private readonly logger = new Logger(ContextRetrievalService.name);

  constructor(
    @Inject(VECTOR_STORE) private readonly vectorStore: PGVectorStore,
    private readonly prisma: PrismaService,
  ) {}

  async vectorRetrieve(query: string): Promise<string> {
    const vectorDocs = await this.vectorStore.similaritySearch(query, 5);

    const keywordQuery = query.slice(0, 80);
    const keywordDocs = await this.prisma.$queryRaw<
      { content: string; metadata: Record<string, string> }[]
    >`
      SELECT content, metadata
      FROM document_chunks
      WHERE content ILIKE ${'%' + keywordQuery + '%'}
      LIMIT 3
    `;

    const allDocs = [
      ...vectorDocs.map((d) => ({
        content: d.pageContent,
        sourceUrl: d.metadata.sourceUrl as string,
      })),
      ...keywordDocs.map((d) => ({
        content: d.content,
        sourceUrl: d.metadata?.sourceUrl ?? '',
      })),
    ];

    const seen = new Set<string>();
    const unique = allDocs.filter((d) => {
      const key = d.content.slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    this.logger.log(`[vectorRetrieve] docs=${unique.length}`);
    return unique.map((d) => d.content).join('\n\n---\n\n');
  }

  async dbRetrieve(query: string): Promise<string> {
    const q = query.toLowerCase();
    this.logger.log(`[dbRetrieve] query="${q.slice(0, 80)}"`);

    if (/news|article|latest|tin tức|新聞|最新/.test(q)) {
      this.logger.log('[dbRetrieve] → news redirect');
      return 'For the latest news, please visit the News page at /news on our platform.';
    }

    if (/advertis|ad package|sponsor|quảng cáo|廣告/.test(q)) {
      this.logger.log('[dbRetrieve] → ad packages lookup');
      const categories = await this.prisma.adPackageCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: AD_CATEGORY_SELECT,
      });
      return this.formatAdPackages(categories);
    }

    return 'No live data is available for this query. Answer based on your general knowledge of the platform only.';
  }

  private formatAdPackages(categories: AdCategoryWithPackages[]): string {
    if (!categories.length) return 'No advertising packages are currently available.';

    return categories
      .map((cat) => {
        const catName = cat.nameZh ?? cat.name;
        const catDesc = cat.description ? ` — ${cat.description}` : '';
        const packageLines = cat.packages
          .map((pkg) => {
            const pkgName = pkg.nameZh ?? pkg.name;
            const pkgDesc = pkg.description ? ` — ${pkg.description}` : '';
            const pricingLines = pkg.pricing.map((pr) => {
              const duration =
                pr.durationValue && pr.durationUnit
                  ? `${pr.durationValue} ${pr.durationUnit.toLowerCase()}`
                  : pr.pricingModel;
              const base = Number(pr.basePrice).toLocaleString('en-US');
              const final = Number(pr.finalPrice).toLocaleString('en-US');
              const discount = Number(pr.discountRate);
              const discountStr =
                discount > 0 ? ` (${(discount * 100).toFixed(0)}% off, was ${base} VND)` : '';
              return `      - ${duration}: ${final} VND${discountStr}`;
            });
            return [`  - **${pkgName}** [${pkg.type}]${pkgDesc}`, ...pricingLines].join('\n');
          })
          .join('\n');
        return `### ${catName}${catDesc}\n${packageLines}`;
      })
      .join('\n\n');
  }
}
