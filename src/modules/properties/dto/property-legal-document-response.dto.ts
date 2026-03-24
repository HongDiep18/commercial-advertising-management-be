import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Represents a legal document attached to a property.
 */
export class PropertyLegalDocumentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty({ example: 'https://cdn.example.com/properties/docs/doc-1.pdf' })
  fileUrl!: string;

  @ApiProperty({ example: 'ownership-certificate.pdf' })
  fileName!: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  mimeType!: string | null;

  @ApiPropertyOptional({ example: 512 })
  fileSizeKb!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}
