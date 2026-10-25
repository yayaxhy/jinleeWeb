-- No inferred legacy backfill: an old gift with consumed vouchers needs manual review.
ALTER TABLE "gift_audit" ADD COLUMN "voucherConsumption" JSONB;
