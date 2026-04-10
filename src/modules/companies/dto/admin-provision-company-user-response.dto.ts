import { ApiProperty } from '@nestjs/swagger';

export class AdminProvisionCompanyUserResponseDto {
  @ApiProperty({
    enum: ['created', 'linked_existing', 'existing_same_company'],
    description:
      'created — new user account created; ' +
      'linked_existing — existing user (no company) linked to this company; ' +
      'existing_same_company — user already linked to this company, no changes made',
  })
  status!: 'created' | 'linked_existing' | 'existing_same_company';

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty()
  setPasswordEmailSent!: boolean;
}
