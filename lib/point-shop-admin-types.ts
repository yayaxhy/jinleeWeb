import type { CustomVoucherRule } from './custom-voucher';

export type PointShopAdminItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  canEditVoucher: boolean;
  pointsCost: string;
  stock: number | null;
  couponExpireDays: number | null;
  sortOrder: number;
  isActive: boolean;
  voucherRule: CustomVoucherRule | null;
  updatedAt: string;
};

export type PointShopAdminData = {
  items: PointShopAdminItem[];
  gifts: string[];
};
