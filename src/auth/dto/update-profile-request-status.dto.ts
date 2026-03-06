import { UserProfileRequestStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateProfileRequestStatusDto {
  @IsNotEmpty()
  @IsEnum(UserProfileRequestStatus)
  status: UserProfileRequestStatus;
}
