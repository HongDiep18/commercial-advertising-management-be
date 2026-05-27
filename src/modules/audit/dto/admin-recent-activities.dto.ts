import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  ADMIN_RECENT_ACTIVITIES_DEFAULT_LIMIT,
  ADMIN_RECENT_ACTIVITIES_DEFAULT_PAGE,
  ADMIN_RECENT_ACTIVITIES_DEFAULT_SORT_ORDER,
  ADMIN_RECENT_ACTIVITIES_MAX_LIMIT,
} from '../admin-recent-activities.constants';

export class AdminRecentActivitiesQueryDto {
  @ApiPropertyOptional({
    default: ADMIN_RECENT_ACTIVITIES_DEFAULT_PAGE,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = ADMIN_RECENT_ACTIVITIES_DEFAULT_PAGE;

  @ApiPropertyOptional({
    default: ADMIN_RECENT_ACTIVITIES_DEFAULT_LIMIT,
    minimum: 1,
    maximum: ADMIN_RECENT_ACTIVITIES_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_RECENT_ACTIVITIES_MAX_LIMIT)
  limit?: number = ADMIN_RECENT_ACTIVITIES_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description:
      'Search by email, activity title (e.g. "Profile request submitted"), or changed values (old/new).',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: ADMIN_RECENT_ACTIVITIES_DEFAULT_SORT_ORDER,
    description:
      '`desc` = newest first (latest activity on top). `asc` = oldest first.',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = ADMIN_RECENT_ACTIVITIES_DEFAULT_SORT_ORDER;
}

export class RecentActivityItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'ISO timestamp' })
  time!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  content!: string;
}

export class AdminRecentActivitiesResponseDto {
  @ApiProperty({ type: [RecentActivityItemDto] })
  activities!: RecentActivityItemDto[];

  @ApiProperty({
    example: { page: 1, limit: 15, total: 150, totalPages: 10 },
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
