import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanyWithAdsResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  contactName!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  industry!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional()
  featuredHighlight?: boolean;

  @ApiPropertyOptional()
  companyInfoHighlight?: boolean;

  @ApiPropertyOptional()
  adLinkUrl?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata based on active ad packages',
    example: {
      printPlacements: [
        {
          adId: '123e4567-e89b-12d3-a456-426614174000',
          orderItemId: '456e7890-e89b-12d3-a456-426614174001',
          metadata: {
            placement: 'magazine_cover',
            size: 'full_page',
          },
        },
      ],
    },
  })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  sortPriority?: number;
}
