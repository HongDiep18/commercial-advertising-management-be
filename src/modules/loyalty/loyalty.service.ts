import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PointsSource } from '../../common/enums/points-source.enum';
import { calculateTier, MembershipTier, TIER_THRESHOLDS } from '../../common/enums/membership-tier.enum';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { ListPointsHistoryQueryDto } from './dto/list-points-history-query.dto';
import { TierInfoResponseDto } from './dto/tier-info-response.dto';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTION, AUDIT_ENTITY } from '../audit/audit.constants';

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Award points to a user
   * @returns PointsTransaction record
   */
  async awardPoints(params: {
    userId: string;
    points: number;
    source: PointsSource;
    description: string;
    metadata?: Record<string, any>;
  }) {
    const { userId, points, source, description, metadata } = params;

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get current balance (from last transaction or user's loyaltyPoints)
    const lastTransaction = await this.prisma.pointsTransaction.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const currentBalance = lastTransaction?.balance ?? user.loyaltyPoints;
    const newBalance = currentBalance + points;

    // Create transaction and update user in a Prisma transaction
    const [transaction] = await this.prisma.$transaction([
      // Create points transaction
      this.prisma.pointsTransaction.create({
        data: {
          userId,
          points,
          balance: newBalance,
          source,
          description,
          metadata: metadata ?? undefined,
        },
      }),
      // Update user's loyalty points
      this.prisma.user.update({
        where: { id: userId },
        data: { loyaltyPoints: newBalance },
      }),
    ]);

    // Recalculate tier
    await this.recalculateTier(userId);

    await this.auditService.record({
      action: AUDIT_ACTION.LOYALTY_POINTS_AWARDED,
      entityType: AUDIT_ENTITY.LOYALTY_TRANSACTION,
      entityId: transaction.id,
      actorId: userId,
      newValue: points.toString(),
      metadata: {
        source,
        balance: newBalance.toString(),
        description,
      },
    });

    return transaction;
  }

  /**
   * Deduct points from a user (admin only)
   * @returns PointsTransaction record
   */
  async deductPoints(params: {
    userId: string;
    points: number;
    reason: string;
    metadata?: Record<string, any>;
  }) {
    const { userId, points, reason, metadata } = params;

    // Use negative points for deduction
    const transaction = await this.awardPoints({
      userId,
      points: -points,
      source: PointsSource.ADMIN_DEDUCTION,
      description: reason,
      metadata,
    });

    await this.auditService.record({
      action: AUDIT_ACTION.LOYALTY_POINTS_DEDUCTED,
      entityType: AUDIT_ENTITY.LOYALTY_TRANSACTION,
      entityId: transaction.id,
      actorId: userId,
      oldValue: (transaction.balance + points).toString(),
      newValue: transaction.balance.toString(),
      metadata: {
        pointsDeducted: points.toString(),
        reason,
      },
    });

    return transaction;
  }

  /**
   * Get user's points history with pagination
   */
  async getHistory(
    userId: string,
    query: ListPointsHistoryQueryDto,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20, source } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (source) {
      where.source = source;
    }

    const [data, total] = await Promise.all([
      this.prisma.pointsTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pointsTransaction.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user's current balance
   */
  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        loyaltyPoints: true,
        totalSpending: true,
        membershipTier: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return {
      userId: user.id,
      loyaltyPoints: user.loyaltyPoints,
      totalSpending: user.totalSpending,
      currentTier: user.membershipTier,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Get tier information and progress
   */
  async getTierInfo(userId: string): Promise<TierInfoResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        loyaltyPoints: true,
        totalSpending: true,
        membershipTier: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const currentPoints = user.loyaltyPoints;
    const currentSpending = user.totalSpending;
    const currentTier = user.membershipTier;

    // Determine next tier
    const tiers = [
      MembershipTier.NONE,
      MembershipTier.BRONZE,
      MembershipTier.SILVER,
      MembershipTier.GOLD,
      MembershipTier.DIAMOND,
    ];

    const currentIndex = tiers.indexOf(currentTier);
    const nextTier = currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;

    let pointsToNextTier: number | null = null;
    let spendingToNextTier: bigint | null = null;

    if (nextTier && nextTier !== MembershipTier.NONE) {
      const nextThreshold = TIER_THRESHOLDS[nextTier];
      pointsToNextTier = Math.max(0, nextThreshold.points - currentPoints);
      spendingToNextTier = BigInt(Math.max(0, nextThreshold.spending - Number(currentSpending)));
    }

    return {
      currentTier,
      currentPoints,
      currentSpending: currentSpending.toString(),
      nextTier,
      pointsToNextTier,
      spendingToNextTier: spendingToNextTier?.toString() ?? null,
    };
  }

  /**
   * Recalculate user's tier based on points and spending
   * Updates User.membershipTier if tier changed
   * @returns New tier
   */
  async recalculateTier(userId: string, adminUserId?: string): Promise<MembershipTier> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        loyaltyPoints: true,
        totalSpending: true,
        membershipTier: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const newTier = calculateTier(user.loyaltyPoints, Number(user.totalSpending));

    // Log tier recalculation (always)
    await this.auditService.record({
      action: AUDIT_ACTION.LOYALTY_TIER_RECALCULATED,
      entityType: AUDIT_ENTITY.USER,
      entityId: userId,
      actorId: adminUserId ?? userId,
      metadata: {
        loyaltyPoints: user.loyaltyPoints.toString(),
        totalSpending: user.totalSpending.toString(),
        calculatedTier: newTier,
        previousTier: user.membershipTier,
      },
    });

    // Only update if tier changed
    if (user.membershipTier !== newTier) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { membershipTier: newTier },
      });

      // Log tier change
      await this.auditService.record({
        action: AUDIT_ACTION.LOYALTY_TIER_CHANGED,
        entityType: AUDIT_ENTITY.USER,
        entityId: userId,
        actorId: adminUserId ?? userId,
        oldValue: user.membershipTier,
        newValue: newTier,
        metadata: {
          loyaltyPoints: user.loyaltyPoints.toString(),
          totalSpending: user.totalSpending.toString(),
        },
      });
    }

    return newTier;
  }
}
