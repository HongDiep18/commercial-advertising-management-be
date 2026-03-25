import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminListNotificationsQueryDto } from './dto/admin-list-notifications-query.dto';
import { AdminListNotificationsResponseDto } from './dto/admin-list-notifications-response.dto';
import { AdminNotificationReadAllResponseDto } from './dto/admin-notification-read-all-response.dto';
import { AdminNotificationReadResponseDto } from './dto/admin-notification-read-response.dto';
import { AdminNotificationUnreadCountDto } from './dto/admin-notification-unread-count.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Admin - Notifications')
@ApiBearerAuth()
@Controller('admin/notifications')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List admin notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    type: AdminListNotificationsResponseDto,
  })
  async listNotifications(
    @Query() query: AdminListNotificationsQueryDto,
  ): Promise<AdminListNotificationsResponseDto> {
    return this.notificationsService.listAdminNotifications(query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notifications count',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread notifications count retrieved successfully',
    type: AdminNotificationUnreadCountDto,
  })
  async getUnreadCount(): Promise<AdminNotificationUnreadCountDto> {
    return this.notificationsService.getAdminUnreadCount();
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark a notification as read',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    type: AdminNotificationReadResponseDto,
  })
  async markNotificationAsRead(
    @Param('id') id: string,
  ): Promise<AdminNotificationReadResponseDto> {
    return this.notificationsService.markAdminNotificationAsRead(id);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all unread notifications as read',
  })
  @ApiResponse({
    status: 200,
    description: 'All unread notifications marked as read',
    type: AdminNotificationReadAllResponseDto,
  })
  async markAllNotificationsAsRead(): Promise<AdminNotificationReadAllResponseDto> {
    return this.notificationsService.markAllAdminNotificationsAsRead();
  }
}
