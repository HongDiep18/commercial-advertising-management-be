import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  upload_logo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_vi?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_cn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  tax_id?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  contact_person?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  contact_phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  company_address?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  country?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  region?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  industry?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  website?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  introduction?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  membership_tier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  captcha?: string;
}
