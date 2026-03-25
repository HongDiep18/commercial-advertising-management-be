import { Controller, Get, UseGuards } from '@nestjs/common';
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
import { AdminRecentActivitiesResponseDto } from './dto/admin-recent-activities.dto';

@ApiTags('Admin - Audit')
@ApiBearerAuth()
@Controller('admin/recent-activities')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'List recent activity logs',
    description: 'Returns the latest 5 recent activities.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent activities retrieved successfully',
    type: AdminRecentActivitiesResponseDto,
  })
  async listRecentActivities(): Promise<AdminRecentActivitiesResponseDto> {
    return this.auditService.listRecentActivities();
  }
}
