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
import { AuditService } from './audit.service';
import {
  AdminRecentActivitiesQueryDto,
  AdminRecentActivitiesResponseDto,
} from './dto/admin-recent-activities.dto';

@ApiTags('Admin - Audit')
@ApiBearerAuth()
@Controller('admin/recent-activities')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'List recent activity logs (paginated)',
    description:
      'Returns audit log entries with pagination (default 15 per page). ' +
      'Use `sortOrder=desc` for newest first (default) or `sortOrder=asc` for oldest first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent activities retrieved successfully',
    type: AdminRecentActivitiesResponseDto,
  })
  async listRecentActivities(
    @Query() query: AdminRecentActivitiesQueryDto,
  ): Promise<AdminRecentActivitiesResponseDto> {
    return this.auditService.listRecentActivities(query);
  }
}
