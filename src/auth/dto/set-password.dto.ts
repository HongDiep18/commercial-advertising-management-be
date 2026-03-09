import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SetPasswordDto {
  @ApiProperty({
    description: 'Token from the set-password email link',
  })
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token!: string;

  @ApiProperty({
    description:
      'New password (8–128 chars: one uppercase, one lowercase, one number, one special character)',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must be at most 128 characters' })
  @Matches(
    /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\s!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/,
    {
      message:
        'Password must contain at least one letter and at least one number',
    },
  )
  @Matches(/^(?=.*[A-Z])/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/^(?=.*[a-z])/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/^(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/, {
    message: 'Password must contain at least one special character',
  })
  password!: string;
}
