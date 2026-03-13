import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CompanyDirectoryQueryDto {
  @ApiPropertyOptional({
    description: 'Search term for company name, industry, or description',
    example: 'manufacturing',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by industry',
    example: 'Manufacturing',
  })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of companies per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['name', 'industry', 'createdAt'],
    default: 'name',
    example: 'name',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'industry' | 'createdAt' = 'name';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'asc',
    example: 'asc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

export class CompanyDirectoryItemDto {
  @ApiProperty({
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({ example: 'VN Buyer Guide Co.' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Public logo URL for company card',
    example: 'https://cdn.example.com/company-logos/acme.png',
  })
  logoUrl?: string | null;

  @ApiProperty({ example: 'contact@vnbuyerguide.com' })
  email!: string;

  @ApiProperty({ example: 'Jane Nguyen' })
  contactName!: string;

  @ApiProperty({ example: '+84 28 1234 5678' })
  phone!: string;

  @ApiProperty({ example: 'Manufacturing' })
  industry!: string;

  @ApiProperty({
    example: '12 Nguyen Hue, District 1, Ho Chi Minh City, Vietnam',
  })
  address!: string;

  @ApiProperty({
    example:
      'We help international buyers find trusted Vietnamese suppliers across key industries.',
  })
  description!: string;

  @ApiProperty({
    description: 'Whether this company has info highlight boost active',
    example: false,
  })
  companyInfoHighlight!: boolean;

  @ApiProperty({
    description:
      'Sort priority for category top placement (higher = more prominent)',
    example: 0,
  })
  sortPriority!: number;
}

export class CompanyDirectoryResponseDto {
  @ApiProperty({ type: [CompanyDirectoryItemDto] })
  companies!: CompanyDirectoryItemDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 20,
      total: 150,
      totalPages: 8,
    },
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class CompanyCategoryItemDto {
  @ApiProperty({
    description: 'Raw industry name from the database',
    example: '紡織、成衣及配件',
  })
  industry!: string;

  @ApiProperty({
    description: 'Number of companies in this category',
    example: 238,
  })
  count!: number;
}

export class CompanyCategoriesResponseDto {
  @ApiProperty({ type: [CompanyCategoryItemDto] })
  categories!: CompanyCategoryItemDto[];
}
