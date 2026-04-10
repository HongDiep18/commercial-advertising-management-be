import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class AdminUpdateCompanyActiveDto {
  @ApiProperty({
    description: 'Set company isActive to true (enable) or false (disable)',
  })
  @IsBoolean({ message: 'isActive must be true or false' })
  isActive!: boolean;
}
