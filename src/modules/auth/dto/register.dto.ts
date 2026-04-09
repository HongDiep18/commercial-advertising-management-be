import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  captchaId: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  captcha: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_vi: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_en?: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_zh: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[+\d\s()-]+$/, {
    message:
      'Phone must contain only numbers, spaces, and phone symbols (+, -, (), spaces)',
  })
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
  @Matches(/^[+\d\s()-]+$/, {
    message:
      'Phone must contain only numbers, spaces, and phone symbols (+, -, (), spaces)',
  })
  contact_phone: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  company_address: string;

  @IsEmail()
  @MaxLength(255)
  company_email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  country: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  region?: string;

  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  industry: string[];

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(/^https?:\/\/[^\s]+$/, {
    message: 'Website must be a valid HTTP or HTTPS URL',
  })
  website: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[+\d\s()-]+$/, {
    message:
      'Phone must contain only numbers, spaces, and phone symbols (+, -, (), spaces)',
  })
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
  note?: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  introduction: string;
}

