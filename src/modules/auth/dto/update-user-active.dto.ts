import { IsBoolean } from 'class-validator';

export class UpdateUserActiveDto {
  @IsBoolean({ message: 'isActive must be true or false' })
  isActive: boolean;
}
