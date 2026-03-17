import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type AdminUserStatus = 'active' | 'suspended' | 'deleted';

export class AdminListUsersQueryDto {
  @ApiPropertyOptional({ description: 'Search by email/contact/company name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by role (e.g. MEMBER, ADMIN)' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['active', 'suspended', 'deleted'],
  })
  @IsOptional()
  @IsIn(['active', 'suspended', 'deleted'])
  status?: AdminUserStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['lastLoginAt', 'createdAt', 'email', 'companyName', 'status'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['lastLoginAt', 'createdAt', 'email', 'companyName', 'status'])
  sortBy?: 'lastLoginAt' | 'createdAt' | 'email' | 'companyName' | 'status' =
    'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class AdminUserListItemDto {
  @ApiProperty({ description: 'User id', format: 'uuid' })
  userId!: string;

  @ApiPropertyOptional({ description: 'Company id', format: 'uuid' })
  companyId!: string | null;

  @ApiPropertyOptional()
  contactName!: string | null;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  companyNameVi!: string | null;

  @ApiPropertyOptional()
  companyNameCn!: string | null;

  @ApiProperty()
  role!: string;

  @ApiPropertyOptional({ description: 'Last login timestamp (ISO)' })
  lastLoginAt!: string | null;

  @ApiProperty({ enum: ['active', 'suspended', 'deleted'] })
  status!: AdminUserStatus;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional()
  deletedAt!: string | null;
}

export class AdminListUsersResponseDto {
  @ApiProperty({ type: [AdminUserListItemDto] })
  users!: AdminUserListItemDto[];

  @ApiProperty({
    example: { page: 1, limit: 20, total: 150, totalPages: 8 },
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
