import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AdminCreateUserDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class AdminCreateUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: 'ADMIN' })
  role!: string;

  @ApiProperty({ enum: ['active', 'suspended'] })
  status!: 'active' | 'suspended';
}
