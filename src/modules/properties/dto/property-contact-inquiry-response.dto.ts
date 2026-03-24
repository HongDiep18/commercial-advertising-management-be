import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Represents a property contact inquiry returned by the API.
 */
export class PropertyContactInquiryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  name!: string;

  @ApiProperty({ example: 'buyer@example.com' })
  email!: string;

  @ApiPropertyOptional({
    example: 'I am interested in this property. Please contact me.',
  })
  message!: string | null;
}
