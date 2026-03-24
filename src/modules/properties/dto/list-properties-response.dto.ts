import { ApiProperty } from '@nestjs/swagger';
import { PropertyResponseDto } from './property-response.dto';

/**
 * Represents a paginated property list response.
 */
export class ListPropertiesResponseDto {
  @ApiProperty({ type: [PropertyResponseDto] })
  properties!: PropertyResponseDto[];

  @ApiProperty({
    example: {
      page: 1,
      limit: 20,
      total: 100,
      totalPages: 5,
    },
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
