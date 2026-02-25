import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListNewsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Filter by category slug (case-insensitive). Categories are seeded as "NEWS", "BUSINESS", "TECH", "ENTERTAINMENT", "LIFESTYLE".',
  })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({ description: 'Filter by subcategory ID (UUID)' })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;
}
