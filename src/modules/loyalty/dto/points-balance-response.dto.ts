import { ApiProperty } from '@nestjs/swagger';
import { MembershipTier } from '../../../common/enums/membership-tier.enum';

export class PointsBalanceResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  loyaltyPoints!: number;

  @ApiProperty()
  totalSpending!: string; // BigInt as string

  @ApiProperty({ enum: MembershipTier })
  currentTier!: MembershipTier;

  @ApiProperty()
  updatedAt!: Date;
}
