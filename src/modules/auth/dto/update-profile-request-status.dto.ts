import { CompanyProfileRequestStatus } from '@prisma/client';
import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateProfileRequestStatusDto {
  @IsNotEmpty()
  @IsIn([
    CompanyProfileRequestStatus.PENDING,
    CompanyProfileRequestStatus.APPROVED,
    CompanyProfileRequestStatus.REJECTED,
  ])
  status: CompanyProfileRequestStatus;
}
