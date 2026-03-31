import { ApiProperty } from '@nestjs/swagger';
import { CompanyWithAdsResponseDto } from '../../companies/dto/company-with-ads-response.dto';

export class AdOrderPreviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  orderId!: string;

  @ApiProperty({
    type: [CompanyWithAdsResponseDto],
    description:
      'Companies that would appear in the priority popup modal, with the ordering company injected based on their purchased package',
  })
  popupPriority!: CompanyWithAdsResponseDto[];

  @ApiProperty({
    type: [CompanyWithAdsResponseDto],
    description:
      'Companies in the rotational sticky bottom banner, with the ordering company injected based on their purchased package',
  })
  popupRotational!: CompanyWithAdsResponseDto[];

  @ApiProperty({
    type: [CompanyWithAdsResponseDto],
    description:
      'Companies in the featured section, with the ordering company injected based on their purchased package',
  })
  featuredCompanies!: CompanyWithAdsResponseDto[];
}
