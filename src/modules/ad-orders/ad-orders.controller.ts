import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../common/interfaces/user-payload.interface';
import { FileUploadService } from '../file-upload/file-upload.service';
import { AdOrdersErrors } from './ad-orders.errors';
import type { AdOrderSummary } from './ad-orders.service';
import { AdOrdersService } from './ad-orders.service';
import { CreateAdOrderDto } from './dto/create-ad-order.dto';
import {
  AttachAdOrderAssetsFormDto,
  UploadAdOrderAssetsDto,
} from './dto/upload-ad-order-assets.dto';
import {
  UserOrderHistoryQueryDto,
  UserOrderHistoryResponseDto,
} from './dto/user-order-history.dto';

@ApiTags('Ad Orders')
@ApiBearerAuth()
@Controller('ad-orders')
export class AdOrdersController {
  constructor(
    private readonly adOrdersService: AdOrdersService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  /**
   * Step 1: Create a draft ad order with its items.
   */
  @Post()
  @ApiOperation({
    summary: 'Create draft ad order with items (step 1)',
    description:
      'Creates a draft ad order and associated items. Assets are attached in a separate step.',
  })
  @ApiBody({ type: CreateAdOrderDto })
  @ApiResponse({
    status: 201,
    description: 'Draft order created successfully',
  })
  async createDraftOrder(
    @CurrentUser() user: UserPayload,
    @Body() body: CreateAdOrderDto,
  ): Promise<AdOrderSummary> {
    return this.adOrdersService.createDraftOrder(user.userId, body);
  }

  /**
   * Step 2: Attach assets to order items and submit the order.
   */
  @Post(':orderId/assets')
  @ApiOperation({
    summary: 'Attach assets and submit order (step 2)',
    description:
      'Optionally attaches assets to order items and submits the order for admin approval. This must be called after creating a draft order.',
  })
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pricingIds: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uuid',
          },
          description:
            'Optional pricing IDs, one per file. Repeat the same ID to attach multiple assets to the same order item.',
        },
        assetTypes: {
          type: 'array',
          items: {
            type: 'string',
          },
          description:
            'Optional asset types, one per file (e.g. main_image, logo, banner).',
        },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description:
            'Optional files to upload. If provided, indices must align with pricingIds and assetTypes arrays.',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Order submitted successfully (with or without assets). Status changed to PENDING for admin approval.',
  })
  async attachAssetsAndSubmitOrder(
    @CurrentUser() user: UserPayload,
    @Param('orderId') orderId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() form: AttachAdOrderAssetsFormDto,
  ): Promise<AdOrderSummary> {
    const pricingIds = form.pricingIds ?? [];
    const assetTypes = form.assetTypes ?? [];
    const uploadedFiles = files ?? [];

    if (uploadedFiles.length > 0) {
      if (pricingIds.length === 0 || assetTypes.length === 0) {
        throw new BadRequestException(
          AdOrdersErrors.INVALID_ASSET_METADATA_REQUIRED,
        );
      }

      if (
        pricingIds.length !== uploadedFiles.length ||
        assetTypes.length !== uploadedFiles.length
      ) {
        throw new BadRequestException(
          AdOrdersErrors.INVALID_ASSET_METADATA_MISMATCH,
        );
      }
    }

    const uploadedAssets: UploadAdOrderAssetsDto['assets'] = [];
    if (uploadedFiles.length > 0) {
      for (let i = 0; i < uploadedFiles.length; i += 1) {
        const file = uploadedFiles[i];
        const uploaded = await this.fileUploadService.uploadFile(
          file,
          'ad-orders',
        );
        uploadedAssets.push({
          pricingId: pricingIds[i],
          assetType: assetTypes[i],
          fileUrl: uploaded.url,
          fileSizeKb: uploaded.sizeKb,
          notes: undefined,
        });
      }
    }

    const payload: UploadAdOrderAssetsDto = {
      assets: uploadedAssets.length > 0 ? uploadedAssets : undefined,
    };

    return this.adOrdersService.attachAssetsAndSubmitOrder(
      user.userId,
      orderId,
      payload,
    );
  }

  /**
   * Get user's order history
   */
  @Get('my-orders')
  @ApiOperation({
    summary: 'Get my order history',
    description: "Get a paginated list of the current user's ad orders",
  })
  @ApiResponse({
    status: 200,
    description: 'Order history retrieved successfully',
    type: UserOrderHistoryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  async getMyOrders(
    @CurrentUser() user: UserPayload,
    @Query() query: UserOrderHistoryQueryDto,
  ): Promise<UserOrderHistoryResponseDto> {
    return this.adOrdersService.getUserOrderHistory(user.userId, query);
  }

  /**
   * Download order invoice as PDF
   */
  @Get(':orderId/invoice')
  @ApiOperation({
    summary: 'Download order invoice',
    description:
      'Download a PDF invoice for the specified order. Only the order owner can download.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice PDF file',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to access this order' })
  @Header('Content-Type', 'application/pdf')
  async downloadOrderInvoice(
    @CurrentUser() user: UserPayload,
    @Param('orderId') orderId: string,
  ): Promise<StreamableFile> {
    const { stream, filename } = await this.adOrdersService.getOrderInvoice(
      user.userId,
      orderId,
    );
    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
