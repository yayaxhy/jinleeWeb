-- Additive only. Legacy rows retain NULL rules and existing behavior.
ALTER TABLE "PointShopItem" ADD COLUMN "voucherRule" JSONB;
ALTER TABLE "PointShopCartItem" ADD COLUMN "voucherRuleSnapshot" JSONB,
  ADD COLUMN "couponExpireDaysSnapshot" INTEGER;
ALTER TABLE "PointShopOrderItem" ADD COLUMN "voucherRuleSnapshot" JSONB,
  ADD COLUMN "couponExpireDaysSnapshot" INTEGER;
ALTER TABLE "PointShopGrant" ADD COLUMN "voucherRuleSnapshot" JSONB;
