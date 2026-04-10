import { ApiProperty } from '@nestjs/swagger';

export class AdminCompanyActiveResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  isActive!: boolean;
}
