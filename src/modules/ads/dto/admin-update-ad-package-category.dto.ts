import { PartialType } from '@nestjs/swagger';
import { AdminCreateAdPackageCategoryDto } from './admin-create-ad-package-category.dto';

export class AdminUpdateAdPackageCategoryDto extends PartialType(
  AdminCreateAdPackageCategoryDto,
) {}
