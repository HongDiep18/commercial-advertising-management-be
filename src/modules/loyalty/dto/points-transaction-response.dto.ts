import { ApiProperty } from '@nestjs/swagger';
import { PointsSource } from '../../../common/enums/points-source.enum';

export class PointsTransactionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  points!: number;

  @ApiProperty()
  balance!: number;

  @ApiProperty({ enum: PointsSource })
  source!: PointsSource;

  @ApiProperty()
  description!: string;

  @ApiProperty({ required: false })
  metadata?: Record<string, any>;

  @ApiProperty()
  createdAt!: Date;
}
