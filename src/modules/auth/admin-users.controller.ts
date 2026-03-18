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
    summary: 'List users for admin table',
    description:
      'Returns users with company info, role, last login, status, plus ids for actions.',
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
