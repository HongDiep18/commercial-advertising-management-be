import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { REGISTRATION_MEMBERSHIP_LEVELS } from '../../../common/enums/membership-tier.enum';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_vi: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_cn: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  tax_id: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  contact_person: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  contact_phone: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  company_address: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  country: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  region: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  industry: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  website: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  introduction: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  captcha: string;

  @IsOptional()
  @ValidateIf((_o, v) => v != null && v !== '')
  @IsString()
  @IsIn(REGISTRATION_MEMBERSHIP_LEVELS as unknown as string[], {
    message: `membership_tier must be one of: ${REGISTRATION_MEMBERSHIP_LEVELS.join(', ')}`,
  })
  @MaxLength(32)
  membership_tier?: string;
}
