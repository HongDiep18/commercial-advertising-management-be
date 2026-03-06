import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NewsArticleStatus, Prisma } from '@prisma/client';

const FALLBACK_THUMBNAIL =
  'https://about.fb.com/wp-content/uploads/2024/02/Facebook-News-Update_US_AU_Header.jpg?fit=1920%2C1080';

type ArticleWithRelations = Prisma.NewsArticleGetPayload<{
  include: { category: true; subcategory: true };
}>;

class NewsCategoryDto {
  @ApiProperty() id: string;
  @ApiProperty() slug: string;
  @ApiProperty() nameVi: string;
  @ApiProperty() nameZhTw: string;
  @ApiProperty() nameEn: string;
}

class NewsSubcategoryDto {
  @ApiProperty() id: string;
  @ApiProperty() slug: string;
  @ApiProperty() nameVi: string;
  @ApiProperty() nameZhTw: string;
  @ApiProperty() nameEn: string;
}

export class NewsCategoryWithSubsDto {
  @ApiProperty() id: string;
  @ApiProperty() slug: string;
  @ApiProperty() nameVi: string;
  @ApiProperty() nameZhTw: string;
  @ApiProperty() nameEn: string;
  @ApiProperty({ type: [NewsSubcategoryDto] })
  subcategories: NewsSubcategoryDto[];
}

export class NewsArticleDto {
  @ApiProperty() id: string;
  @ApiProperty() sourceSite: string;
  @ApiProperty() url: string;
  @ApiPropertyOptional() guid?: string | null;
  @ApiProperty() title: string;
  @ApiPropertyOptional() titleZhTw?: string | null;
  @ApiPropertyOptional() titleEn?: string | null;
  @ApiProperty() publishedAt: Date;
  @ApiProperty() thumbnailUrl: string;
  @ApiProperty() status: NewsArticleStatus;

  @ApiPropertyOptional({ type: NewsCategoryDto })
  category?: NewsCategoryDto | null;

  @ApiPropertyOptional({ type: NewsSubcategoryDto })
  subcategory?: NewsSubcategoryDto | null;

  @ApiPropertyOptional() summaryVi?: string | null;
  @ApiPropertyOptional() summaryZhTw?: string | null;
  @ApiPropertyOptional() summaryEn?: string | null;

  static fromEntity(entity: ArticleWithRelations): NewsArticleDto {
    return {
      id: entity.id,
      sourceSite: entity.sourceSite,
      url: entity.url,
      guid: entity.guid ?? null,
      title: entity.title,
      titleZhTw: entity.titleZhTw ?? null,
      titleEn: entity.titleEn ?? null,
      publishedAt: entity.publishedAt,
      thumbnailUrl: entity.thumbnailUrl ?? FALLBACK_THUMBNAIL,
      status: entity.status,
      category: entity.category ?? null,
      subcategory: entity.subcategory ?? null,
      summaryVi: entity.summaryVi ?? null,
      summaryZhTw: entity.summaryZhTw ?? null,
      summaryEn: entity.summaryEn ?? null,
    };
  }
}
