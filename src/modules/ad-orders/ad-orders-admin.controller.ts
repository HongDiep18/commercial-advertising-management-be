import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { UserPayload } from '../../common/interfaces/user-payload.interface';
import type { AdOrderSummary } from './ad-orders.service';
import { AdOrdersService } from './ad-orders.service';
import type { AdminOrderDto } from './dto/admin-list-orders.dto';
import {
  AdminListOrdersQueryDto,
  AdminListOrdersResponseDto,
} from './dto/admin-list-orders.dto';
import {
  AdminApproveOrderDto,
  AdminEditPendingOrderDto,
  AdminOrderActionResponseDto,
  AdminRejectOrderDto,
} from './dto/admin-order-actions.dto';
import { AdminOrdersMetricsResponseDto } from './dto/admin-orders-metrics.dto';

@ApiTags('Admin - Ad Orders')
@ApiBearerAuth()
@Controller('admin/ad-orders')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdOrdersAdminController {
  constructor(private readonly adOrdersService: AdOrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'List ad orders for admin',
    description:
      'Get a paginated list of ad orders with filtering and search capabilities. Admin and Super Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    type: AdminListOrdersResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Insufficient permissions (Admin/Super Admin required)',
  })
  async listOrders(
    @Query() query: AdminListOrdersQueryDto,
  ): Promise<AdminListOrdersResponseDto> {
    const result = await this.adOrdersService.adminListOrders(query);
    return result;
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Get ad orders metrics for dashboard',
    description:
      'Get current month revenue, order counts, and month-over-month revenue growth for ad orders.',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics retrieved successfully',
    type: AdminOrdersMetricsResponseDto,
  })
  async getMetrics(): Promise<AdminOrdersMetricsResponseDto> {
    const metrics = await this.adOrdersService.getAdminOrdersMetrics();
    return metrics;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single ad order by ID',
    description:
      'Retrieve full order details for admin. Admin and Super Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(@Param('id') orderId: string): Promise<AdminOrderDto> {
    return this.adOrdersService.adminGetOrderById(orderId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit a draft or pending ad order',
    description:
      'Update order notes, existing item fields, replace item assets, or append Homepage Popup add-on packages. Recalculates subtotal when add-ons are added. Admin and Super Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Order updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Validation error or order not editable',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async editOrder(
    @Param('id') orderId: string,
    @CurrentUser() admin: UserPayload,
    @Body() dto: AdminEditPendingOrderDto,
  ): Promise<AdOrderSummary> {
    return this.adOrdersService.adminEditPendingOrder(
      orderId,
      admin.userId,
      dto,
    );
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Approve an ad order',
    description:
      'Approve a pending ad order and activate the ads. Admin and Super Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order approved successfully',
    type: AdminOrderActionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Order not in pending status',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async approveOrder(
    @Param('id') orderId: string,
    @CurrentUser() admin: UserPayload,
    @Body() dto: AdminApproveOrderDto,
  ): Promise<AdminOrderActionResponseDto> {
    const result = await this.adOrdersService.approveOrder(
      orderId,
      admin.userId,
      dto,
    );
    return {
      ...result,
      lastUpdatedBy: admin.userId,
      lastUpdatedAt: new Date(),
      reason: dto.reason,
    };
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: 'Reject an ad order',
    description:
      'Reject a pending ad order with a reason. Admin and Super Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order rejected successfully',
    type: AdminOrderActionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Order not in pending status',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async rejectOrder(
    @Param('id') orderId: string,
    @CurrentUser() admin: UserPayload,
    @Body() dto: AdminRejectOrderDto,
  ): Promise<AdminOrderActionResponseDto> {
    const result = await this.adOrdersService.rejectOrder(
      orderId,
      admin.userId,
      dto,
    );
    return {
      ...result,
      lastUpdatedBy: admin.userId,
      lastUpdatedAt: new Date(),
      reason: dto.reason,
    };
  }
}
