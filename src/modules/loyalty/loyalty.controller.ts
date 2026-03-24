import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';
import { AwardPointsDto } from './dto/award-points.dto';
import { ListPointsHistoryQueryDto } from './dto/list-points-history-query.dto';
import { PointsTransactionResponseDto } from './dto/points-transaction-response.dto';
import { PointsBalanceResponseDto } from './dto/points-balance-response.dto';
import { TierInfoResponseDto } from './dto/tier-info-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Loyalty')
@Controller('loyalty')
@ApiBearerAuth()
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  /**
   * Get current user's points balance
   * GET /api/v1/loyalty/balance
   */
  @Get('balance')
  @ApiOperation({ summary: 'Get current user points balance' })
  @ApiOkResponse({ type: PointsBalanceResponseDto })
  async getBalance(@CurrentUser('userId') userId: string) {
    const balance = await this.loyaltyService.getBalance(userId);
    return {
      ...balance,
      totalSpending: balance.totalSpending.toString(),
    };
  }

  /**
   * Get current user's tier info and progress
   * GET /api/v1/loyalty/tier-info
   */
  @Get('tier-info')
  @ApiOperation({ summary: 'Get current user tier info and progress to next tier' })
  @ApiOkResponse({ type: TierInfoResponseDto })
  async getTierInfo(
    @CurrentUser('userId') userId: string,
  ): Promise<TierInfoResponseDto> {
    return this.loyaltyService.getTierInfo(userId);
  }

  /**
   * Get current user's points history
   * GET /api/v1/loyalty/history?page=1&limit=20&source=AD_PURCHASE
   */
  @Get('history')
  @ApiOperation({ summary: 'Get current user points transaction history' })
  @ApiOkResponse({ type: [PointsTransactionResponseDto] })
  async getHistory(
    @CurrentUser('userId') userId: string,
    @Query() query: ListPointsHistoryQueryDto,
  ) {
    return this.loyaltyService.getHistory(userId, query);
  }

  /**
   * Award points to a user (ADMIN only)
   * POST /api/v1/loyalty/award
   */
  @Post('award')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Award points to a user (Admin only)' })
  @ApiCreatedResponse({ type: PointsTransactionResponseDto })
  async awardPoints(@Body() dto: AwardPointsDto) {
    return this.loyaltyService.awardPoints(dto);
  }

  /**
   * Deduct points from a user (ADMIN only)
   * POST /api/v1/loyalty/deduct
   */
  @Post('deduct')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Deduct points from a user (Admin only)' })
  @ApiCreatedResponse({ type: PointsTransactionResponseDto })
  async deductPoints(@Body() dto: AwardPointsDto) {
    // Reuse same DTO, but negate points in service
    return this.loyaltyService.deductPoints({
      userId: dto.userId,
      points: dto.points,
      reason: dto.description,
      metadata: dto.metadata,
    });
  }

  /**
   * Get any user's points history (ADMIN only)
   * GET /api/v1/loyalty/history/all?userId=xxx&page=1&limit=20
   */
  @Get('history/all')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get any user points history (Admin only)' })
  @ApiOkResponse({ type: [PointsTransactionResponseDto] })
  async getAllHistory(@Query() query: ListPointsHistoryQueryDto) {
    if (!query.userId) {
      throw new Error('userId is required for admin history query');
    }
    return this.loyaltyService.getHistory(query.userId, query);
  }

  /**
   * Manually trigger tier recalculation (ADMIN only)
   * POST /api/v1/loyalty/:userId/recalculate-tier
   */
  @Post(':userId/recalculate-tier')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Manually recalculate user tier (Admin only)' })
  @ApiOkResponse({ type: TierInfoResponseDto })
  async recalculateTier(
    @Param('userId') userId: string,
    @CurrentUser('userId') adminUserId: string,
  ) {
    await this.loyaltyService.recalculateTier(userId, adminUserId);
    return this.loyaltyService.getTierInfo(userId);
  }
}
