import { PartialType } from '@nestjs/swagger';
import { AdminCreateAdPackageDto } from './admin-create-ad-package.dto';

export class AdminUpdateAdPackageDto extends PartialType(
  AdminCreateAdPackageDto,
) {}
