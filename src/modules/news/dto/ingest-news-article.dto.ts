import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngestNewsArticleItemDto {
  @ApiProperty({ example: 'vnexpress' })
  @IsString()
  @Length(2, 64)
  sourceSite: string;

  @ApiPropertyOptional({ example: 'kinh-doanh' })
  @IsOptional()
  @IsString()
  @Length(1, 256)
  sourceCategory?: string;

  @ApiPropertyOptional({ example: 'some-guid-from-rss' })
  @IsOptional()
  @IsString()
  @Length(1, 512)
  guid?: string;

  @ApiProperty({ example: 'https://vnexpress.net/some-article.html' })
  @IsUrl({ require_tld: false })
  url: string;

  @ApiProperty({ example: 'Tiêu đề bài báo' })
  @IsString()
  @Length(1, 1024)
  title: string;

  @ApiProperty({ example: '2026-02-12T03:15:00Z' })
  @IsDateString()
  publishedAt: string;

  @ApiPropertyOptional({ example: 'https://i1-vnexpress.vnecdn.net/...jpg' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  thumbnailUrl?: string;

  @ApiPropertyOptional({ example: 'vi' })
  @IsOptional()
  @IsString()
  @Length(2, 16)
  language?: string;

  @ApiPropertyOptional({ example: 'Clean extracted text content...' })
  @IsOptional()
  @IsString()
  contentText?: string;

  @ApiPropertyOptional({ example: '<html>...</html>' })
  @IsOptional()
  @IsString()
  rawHtml?: string;
}

export class IngestNewsArticlesDto {
  @ApiProperty({ type: [IngestNewsArticleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestNewsArticleItemDto)
  articles: IngestNewsArticleItemDto[];
}

export class IngestNewsArticlesResultDto {
  @ApiProperty()
  created: number;

  @ApiProperty()
  updated: number;

  @ApiProperty()
  skipped: number;
}

