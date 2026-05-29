import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from './auth.service';
import {
  AdminCreateUserDto,
  AdminCreateUserResponseDto,
} from './dto/admin-create-user.dto';
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

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new admin user' })
  @ApiResponse({
    status: 201,
    description: 'Admin user created successfully',
    type: AdminCreateUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async createUser(
    @CurrentUser('userId') actorId: string,
    @Body() dto: AdminCreateUserDto,
  ): Promise<AdminCreateUserResponseDto> {
    return this.authService.adminCreateUser(actorId, dto);
  }

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
