import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@vnbuyerguide.com',
    description: 'User email address',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Bronze123!',
    minLength: 8,
    description:
      'User password (min 8 characters, must contain letters and numbers)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\s!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/, {
    message: 'Password must contain at least one letter and one number',
  })
  password!: string;
}
