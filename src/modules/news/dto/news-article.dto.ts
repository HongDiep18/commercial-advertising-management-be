import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NewsArticleStatus } from '../enums/news-article-status.enum';

export class NewsArticleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sourceSite: string;

  @ApiPropertyOptional()
  sourceCategory?: string | null;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional()
  guid?: string | null;

  @ApiProperty()
  title: string;

  @ApiProperty()
  publishedAt: Date;

  @ApiPropertyOptional()
  thumbnailUrl?: string | null;

  @ApiProperty()
  status: NewsArticleStatus;

  @ApiPropertyOptional()
  aiSummaryVi?: string | null;

  @ApiPropertyOptional()
  aiSummaryZhTw?: string | null;

  @ApiPropertyOptional()
  aiSummaryEn?: string | null;

  @ApiProperty({ type: [String] })
  tags: string[];

  static fromEntity(entity: any): NewsArticleDto {
    return {
      id: entity.id,
      sourceSite: entity.sourceSite,
      sourceCategory: entity.sourceCategory ?? null,
      url: entity.url,
      guid: entity.guid ?? null,
      title: entity.title,
      publishedAt: entity.publishedAt,
      thumbnailUrl: entity.thumbnailUrl ?? null,
      status: entity.status,
      aiSummaryVi: entity.aiSummaryVi ?? null,
      aiSummaryZhTw: entity.aiSummaryZhTw ?? null,
      aiSummaryEn: entity.aiSummaryEn ?? null,
      tags: (entity.tags ?? []).map((t: any) => t.tag?.slug ?? t.slug),
    };
  }
}
