import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  ADMIN_LIST_USER_ROLE_FILTERS,
  ADMIN_LIST_USERS_DEFAULT_LIMIT,
  ADMIN_LIST_USERS_DEFAULT_PAGE,
  ADMIN_LIST_USERS_MAX_LIMIT,
  type AdminListUserRoleFilter,
} from '../admin-list-users.constants';

export type AdminUserStatus = 'active' | 'suspended';

export type { AdminListUserRoleFilter };

export class AdminListUsersQueryDto {
  @ApiPropertyOptional({ description: 'Search by email/contact/company name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filter by status (non-deleted users only). Omit for all active and suspended users.',
    enum: ['active', 'suspended'],
  })
  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: AdminUserStatus;

  @ApiPropertyOptional({
    description:
      'Filter by user category: `admin` = ADMIN + SUPER_ADMIN, `user` = MEMBER + VISITOR. Omit for all non-deleted roles.',
    enum: ADMIN_LIST_USER_ROLE_FILTERS,
    example: 'user',
  })
  @IsOptional()
  @IsIn([...ADMIN_LIST_USER_ROLE_FILTERS])
  role?: AdminListUserRoleFilter;

  @ApiPropertyOptional({
    default: ADMIN_LIST_USERS_DEFAULT_PAGE,
    minimum: 1,
    description: 'Current page (1-based)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = ADMIN_LIST_USERS_DEFAULT_PAGE;

  @ApiPropertyOptional({
    default: ADMIN_LIST_USERS_DEFAULT_LIMIT,
    minimum: 1,
    maximum: ADMIN_LIST_USERS_MAX_LIMIT,
    description: 'Users per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_LIST_USERS_MAX_LIMIT)
  limit?: number = ADMIN_LIST_USERS_DEFAULT_LIMIT;

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

  @ApiProperty({ description: 'Account creation timestamp (ISO)' })
  createdAt!: string;

  @ApiPropertyOptional({ description: 'Company id', format: 'uuid' })
  companyId!: string | null;

  @ApiPropertyOptional()
  contactName!: string | null;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  companyNameVi!: string | null;

  @ApiPropertyOptional()
  companyNameZh!: string | null;

  @ApiProperty()
  role!: string;

  @ApiPropertyOptional({ description: 'Last login timestamp (ISO)' })
  lastLoginAt!: string | null;

  @ApiProperty({ enum: ['active', 'suspended'] })
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
    description: 'Pagination metadata for the user list',
    example: { page: 1, limit: 10, total: 150, totalPages: 15 },
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
