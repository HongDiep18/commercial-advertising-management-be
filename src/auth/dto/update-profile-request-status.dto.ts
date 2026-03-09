import { CompanyProfileRequestStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateProfileRequestStatusDto {
  @IsNotEmpty()
  @IsEnum(CompanyProfileRequestStatus)
  status: CompanyProfileRequestStatus;
}
