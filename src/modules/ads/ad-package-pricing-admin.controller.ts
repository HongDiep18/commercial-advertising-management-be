import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdPackagePricingService } from './ad-package-pricing.service';
import { AdminCreatePricingDto } from './dto/admin-create-pricing.dto';
import {
  AdminPricingListQueryDto,
  AdminPricingListResponseDto,
  AdminPricingResponseDto,
} from './dto/admin-pricing-response.dto';
import { AdminUpdatePricingDto } from './dto/admin-update-pricing.dto';

@ApiTags('Admin - Ad Package Pricing')
@ApiBearerAuth()
@Controller('admin/ad-packages')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdPackagePricingAdminController {
  constructor(
    private readonly adPackagePricingService: AdPackagePricingService,
  ) {}

  @Post(':packageId/pricing')
  @ApiOperation({
    summary: 'Create a new pricing option for an ad package',
    description:
      'Creates a new pricing configuration for the specified ad package. The final price is automatically calculated based on base price and discount rate.',
  })
  @ApiParam({
    name: 'packageId',
    description: 'Ad package ID to create pricing for',
    format: 'uuid',
  })
  @ApiResponse({
    status: 201,
    description: 'Pricing option created successfully',
    type: AdminPricingResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or package not found',
  })
  async createPricing(
    @Param('packageId') packageId: string,
    @Body() dto: AdminCreatePricingDto,
    @CurrentUser('userId') adminUserId: string,
  ): Promise<AdminPricingResponseDto> {
    return this.adPackagePricingService.createPricing(packageId, dto, adminUserId);
  }

  @Get('pricing')
  @ApiOperation({
    summary: 'List all pricing options with filtering',
    description:
      'Retrieves a paginated list of all ad package pricing options with optional filtering by package, pricing model, or active status.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pricing options retrieved successfully',
    type: AdminPricingListResponseDto,
  })
  async listPricing(
    @Query() query: AdminPricingListQueryDto,
  ): Promise<AdminPricingListResponseDto> {
    return this.adPackagePricingService.listPricing(query);
  }

  @Get('pricing/:pricingId')
  @ApiOperation({
    summary: 'Get a specific pricing option by ID',
    description:
      'Retrieves detailed information about a specific pricing option.',
  })
  @ApiParam({
    name: 'pricingId',
    description: 'Pricing option ID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Pricing option retrieved successfully',
    type: AdminPricingResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Pricing option not found',
  })
  async getPricingById(
    @Param('pricingId') pricingId: string,
  ): Promise<AdminPricingResponseDto> {
    return this.adPackagePricingService.getPricingById(pricingId);
  }

  @Put('pricing/:pricingId')
  @ApiOperation({
    summary: 'Update a pricing option',
    description:
      'Updates an existing pricing option. The final price is automatically recalculated if base price or discount rate changes.',
  })
  @ApiParam({
    name: 'pricingId',
    description: 'Pricing option ID to update',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Pricing option updated successfully',
    type: AdminPricingResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Pricing option not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async updatePricing(
    @Param('pricingId') pricingId: string,
    @Body() dto: AdminUpdatePricingDto,
    @CurrentUser('userId') adminUserId: string,
  ): Promise<AdminPricingResponseDto> {
    return this.adPackagePricingService.updatePricing(pricingId, dto, adminUserId);
  }

  @Delete('pricing/:pricingId')
  @ApiOperation({
    summary: 'Delete a pricing option',
    description:
      'Deletes a pricing option. Cannot delete if the pricing is used in any orders or active ads - deactivate instead.',
  })
  @ApiParam({
    name: 'pricingId',
    description: 'Pricing option ID to delete',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Pricing option deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Pricing option deleted successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Pricing option not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete pricing option that is in use',
  })
  async deletePricing(
    @Param('pricingId') pricingId: string,
    @CurrentUser('userId') adminUserId: string,
  ): Promise<{ message: string }> {
    return this.adPackagePricingService.deletePricing(pricingId, adminUserId);
  }
}
