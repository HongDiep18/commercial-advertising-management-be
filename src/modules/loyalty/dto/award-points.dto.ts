import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PointsSource } from '../../../common/enums/points-source.enum';

export class AwardPointsDto {
  @ApiProperty({
    description: 'User ID to award points to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'Number of points to award',
    example: 1000,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  points!: number;

  @ApiProperty({
    description: 'Source of points',
    enum: PointsSource,
    example: PointsSource.ADMIN_ADJUSTMENT,
  })
  @IsEnum(PointsSource)
  source!: PointsSource;

  @ApiProperty({
    description: 'Human-readable description',
    example: 'Manual adjustment for testing',
    maxLength: 512,
  })
  @IsString()
  @MaxLength(512)
  description!: string;

  @ApiProperty({
    description: 'Optional metadata (order ID, etc.)',
    required: false,
    example: { orderId: '123', reason: 'compensation' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
