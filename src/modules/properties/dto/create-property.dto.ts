import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PropertyAvailabilityStatus,
  PropertyPublicationStatus,
  PropertyType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Represents the payload used to create a property.
 */
export class CreatePropertyDto {
  @ApiProperty({ example: 'Industrial land in Binh Duong' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'USD 4.5/m²/月' })
  @IsString()
  @MaxLength(128)
  price!: string;

  @ApiProperty({ enum: PropertyType, example: PropertyType.LAND })
  @IsEnum(PropertyType)
  type!: PropertyType;

  @ApiProperty({ example: 'binh-duong' })
  @IsString()
  @MaxLength(128)
  province!: string;

  @ApiProperty({ example: 'Binh Duong' })
  @IsString()
  @MaxLength(255)
  provinceName!: string;

  @ApiProperty({ example: 'Lot A2, VSIP II, Binh Duong, Vietnam' })
  @IsString()
  @MaxLength(512)
  fullAddress!: string;

  @ApiPropertyOptional({ example: 10.8973812 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 106.7218391 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  areaValue!: number;

  @ApiProperty({ example: 'm²' })
  @IsString()
  @MaxLength(32)
  areaUnit!: string;

  @ApiProperty({ example: 'Suitable for logistics and light manufacturing.' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://cdn.example.com/p1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['ready-infrastructure', 'near-port'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({
    enum: PropertyPublicationStatus,
    example: PropertyPublicationStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(PropertyPublicationStatus)
  publicationStatus?: PropertyPublicationStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishedAt?: Date;

  @ApiPropertyOptional({
    enum: PropertyAvailabilityStatus,
    example: PropertyAvailabilityStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(PropertyAvailabilityStatus)
  availabilityStatus?: PropertyAvailabilityStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  soldAt?: Date;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  views?: number;
}
