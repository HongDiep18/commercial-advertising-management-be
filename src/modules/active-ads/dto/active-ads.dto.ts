import { AdPackageType, PricingModel } from '@prisma/client';
import type { AdPackageFormConfig } from '../../ads/ads.constants';

export enum AdStatus {
  EXPIRED = 'expired',
  ACTIVATING = 'activating',
  PENDING = 'pending',
  DISABLED = 'disabled',
}

export type ActiveAdItem = {
  id: string;
  packageType: AdPackageType;
  pricingModel: PricingModel;
  assets: Array<{
    fileUrl: string;
    assetType: string;
  }>;
  adLinkUrl: string | null;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  status: AdStatus;
  formConfig: AdPackageFormConfig;
};

export type ActiveAdDto = {
  company_id: string;
  items: ActiveAdItem[];
};
