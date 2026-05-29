import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminAssignCompanyUserDto {
  @ApiProperty({ example: 'user@company.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}

export class AdminAssignCompanyUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ example: 'MEMBER' })
  role!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ enum: ['created', 'linked'] })
  action!: 'created' | 'linked';

  @ApiProperty()
  setPasswordEmailSent!: boolean;
}
