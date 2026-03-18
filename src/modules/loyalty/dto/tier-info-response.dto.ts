import { ApiProperty } from '@nestjs/swagger';
import { MembershipTier } from '../../../common/enums/membership-tier.enum';

export class TierInfoResponseDto {
  @ApiProperty({ enum: MembershipTier })
  currentTier!: MembershipTier;

  @ApiProperty()
  currentPoints!: number;

  @ApiProperty()
  currentSpending!: string; // BigInt as string

  @ApiProperty({ enum: MembershipTier, nullable: true })
  nextTier!: MembershipTier | null;

  @ApiProperty({ nullable: true })
  pointsToNextTier!: number | null;

  @ApiProperty({ nullable: true })
  spendingToNextTier!: string | null; // BigInt as string
}
