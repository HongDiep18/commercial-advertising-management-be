import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  PropertyAvailabilityStatus,
  PropertyPublicationStatus,
  PropertyType,
} from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * Represents the query parameters used to list properties.
 */
export class ListPropertiesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'binh duong' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ enum: PropertyType, example: PropertyType.LAND })
  @IsOptional()
  @IsEnum(PropertyType)
  type?: PropertyType;

  @ApiPropertyOptional({ example: 'binh-duong' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  province?: string;

  @ApiPropertyOptional({
    enum: PropertyPublicationStatus,
    example: PropertyPublicationStatus.PUBLISHED,
  })
  @IsOptional()
  @IsEnum(PropertyPublicationStatus)
  publicationStatus?: PropertyPublicationStatus;

  @ApiPropertyOptional({
    enum: PropertyAvailabilityStatus,
    example: PropertyAvailabilityStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(PropertyAvailabilityStatus)
  availabilityStatus?: PropertyAvailabilityStatus;

  @ApiPropertyOptional({
    enum: ['createdAt', 'updatedAt', 'publishedAt', 'soldAt', 'title', 'views'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'publishedAt', 'soldAt', 'title', 'views'])
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'publishedAt'
    | 'soldAt'
    | 'title'
    | 'views' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
