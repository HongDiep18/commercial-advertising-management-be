import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PropertyAvailabilityStatus,
  PropertyPublicationStatus,
  PropertyType,
} from '@prisma/client';
import { PropertyLegalDocumentResponseDto } from './property-legal-document-response.dto';

/**
 * Represents a property returned by the API.
 */
export class PropertyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty()
  title!: string;

  @ApiProperty({ example: 'USD 4.5/m²/月' })
  price!: string;

  @ApiProperty({ enum: PropertyType })
  type!: PropertyType;

  @ApiProperty()
  province!: string;

  @ApiProperty()
  provinceName!: string;

  @ApiProperty()
  fullAddress!: string;

  @ApiPropertyOptional({ example: 10.8973812 })
  latitude!: number | null;

  @ApiPropertyOptional({ example: 106.7218391 })
  longitude!: number | null;

  @ApiProperty({ example: 5000 })
  areaValue!: number;

  @ApiProperty({ example: 'm²' })
  areaUnit!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ type: [String] })
  images!: string[];

  @ApiProperty({ type: [String] })
  features!: string[];

  @ApiProperty({ enum: PropertyPublicationStatus })
  publicationStatus!: PropertyPublicationStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  publishedAt!: Date | null;

  @ApiProperty({ enum: PropertyAvailabilityStatus })
  availabilityStatus!: PropertyAvailabilityStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  soldAt!: Date | null;

  @ApiProperty({ example: 128 })
  views!: number;

  @ApiProperty({ type: [PropertyLegalDocumentResponseDto] })
  legalDocuments!: PropertyLegalDocumentResponseDto[];
}
