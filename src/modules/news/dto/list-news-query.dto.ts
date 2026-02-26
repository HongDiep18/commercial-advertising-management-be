import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

export class ListNewsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Filter by category slug(s), comma-separated (case-insensitive). E.g. "NEWS,TECH". Seeded values: NEWS, BUSINESS, TECH, ENTERTAINMENT, LIFESTYLE.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toArray(value))
  categorySlug?: string[];

  @ApiPropertyOptional({ description: 'Filter by subcategory ID(s), comma-separated UUIDs.' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @Transform(({ value }) => toArray(value))
  subcategoryId?: string[];
}
