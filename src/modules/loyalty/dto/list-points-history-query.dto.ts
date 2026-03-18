import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { PointsSource } from '../../../common/enums/points-source.enum';

export class ListPointsHistoryQueryDto extends PaginationDto {
  @ApiProperty({
    description: 'Filter by user ID (admin only)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    description: 'Filter by source',
    enum: PointsSource,
    required: false,
  })
  @IsOptional()
  @IsEnum(PointsSource)
  source?: PointsSource;
}
