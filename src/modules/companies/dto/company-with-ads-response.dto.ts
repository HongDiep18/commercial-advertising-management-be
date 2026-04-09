import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanyWithAdsResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Company logo URL',
    nullable: true,
  })
  logoUrl?: string | null;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  contactName!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty({
    type: [String],
    description: 'Company industries (multi-select)',
  })
  industry!: string[];

  @ApiPropertyOptional({
    description: 'Company country',
    nullable: true,
  })
  country?: string | null;

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
    description:
      'Whether the popup "view details" button should be shown for this company',
    example: false,
  })
  showDetailsButton?: boolean;

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
