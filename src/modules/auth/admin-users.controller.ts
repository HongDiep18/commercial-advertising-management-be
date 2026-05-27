import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from './auth.service';
import {
  AdminListUsersQueryDto,
  AdminListUsersResponseDto,
} from './dto/admin-list-users.dto';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminUsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @ApiOperation({
    summary: 'List users for admin table (paginated)',
    description:
      'Returns non-deleted users. Default 10 per page. ' +
      'Optional `role` filter: `admin` (ADMIN, SUPER_ADMIN) or `user` (MEMBER, VISITOR). ' +
      'Pagination: page, limit, total, totalPages.',
  })
  @ApiResponse({
    status: 200,
    description: 'User list retrieved successfully',
    type: AdminListUsersResponseDto,
  })
  async listUsers(
    @Query() query: AdminListUsersQueryDto,
  ): Promise<AdminListUsersResponseDto> {
    return this.authService.adminListUsers(query);
  }
}
