import { ApiProperty } from '@nestjs/swagger';
import { PropertyContactInquiryResponseDto } from './property-contact-inquiry-response.dto';
import { PropertyResponseDto } from './property-response.dto';

/**
 * Represents a property detail response for administrators with contact inquiries.
 */
export class AdminPropertyDetailResponseDto extends PropertyResponseDto {
  @ApiProperty({ type: [PropertyContactInquiryResponseDto] })
  contactInquiries!: PropertyContactInquiryResponseDto[];

  @ApiProperty({ example: 12 })
  contactInquiryCount!: number;
}
