import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { NewsService } from './news.service';

@Injectable()
export class NewsTranslatorService implements OnModuleInit {
  private readonly logger = new Logger(NewsTranslatorService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly newsService: NewsService,
  ) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('news.openAiApiKey');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY not set — translation is disabled');
    }
  }

  async translatePendingArticles(): Promise<{
    processed: number;
    failed: number;
  }> {
    if (!this.openai) {
      return { processed: 0, failed: 0 };
    }

    const batchSize = this.configService.get<number>(
      'news.translateBatchSize',
      5,
    );
    const articles =
      await this.newsService.findDraftsPendingTranslation(batchSize);

    let processed = 0;
    let failed = 0;

    for (const article of articles) {
      try {
        await this.translateArticle(article);
        processed += 1;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Translation failed for article ${article.id}: ${msg}`,
        );
        failed += 1;
      }
    }

    return { processed, failed };
  }

  private async translateArticle(article: {
    id: string;
    title: string;
    summaryVi: string | null;
    category: { nameEn: string } | null;
  }) {
    const maxChars = this.configService.get<number>(
      'news.maxContentChars',
      4000,
    );
    const model = this.configService.get<string>(
      'news.openAiModel',
      'gpt-4o-mini',
    );
    const summary = (article.summaryVi ?? '').slice(0, maxChars);
    const categoryName = article.category?.nameEn ?? 'General';

    const response = await this.openai!.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `You are a professional translator. Translate the following Vietnamese news title and summary into Traditional Chinese (zh-TW) and English. ` +
            `The article is in the ${categoryName} category. ` +
            `Respond ONLY with a JSON object with exactly four keys: "titleZhTw", "titleEn", "summaryZhTw", "summaryEn".`,
        },
        {
          role: 'user',
          content: JSON.stringify({ title: article.title, summary }),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as {
      titleZhTw?: string;
      titleEn?: string;
      summaryZhTw?: string;
      summaryEn?: string;
    };

    if (
      !parsed.titleZhTw ||
      !parsed.titleEn ||
      !parsed.summaryZhTw ||
      !parsed.summaryEn
    ) {
      throw new Error(`Incomplete translation response: ${raw}`);
    }

    await this.newsService.writeSummary(article.id, {
      titleVi: article.title,
      titleZhTw: parsed.titleZhTw,
      titleEn: parsed.titleEn,
      summaryVi: article.summaryVi!,
      summaryZhTw: parsed.summaryZhTw,
      summaryEn: parsed.summaryEn,
    });
  }
}
