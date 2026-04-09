import {
  IsArray,
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
  company_name_en?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_zh?: string;

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
  @IsArray()
  @IsString({ each: true })
  industry?: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  website?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  fax?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  skype?: string;

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
}

export const UPDATE_PROFILE_FORM_KEYS = [
  'company_name_vi',
  'company_name_en',
  'company_name_zh',
  'phone',
  'tax_id',
  'contact_person',
  'contact_phone',
  'company_address',
  'email',
  'country',
  'region',
  'industry',
  'website',
  'fax',
  'skype',
  'introduction',
  'membership_tier',
] as const;
