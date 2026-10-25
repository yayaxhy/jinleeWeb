-- Preserve the exact profile credited by each new gift. Do not infer legacy
-- ownership from current Discord bindings; positive earn with a null ID needs review.
ALTER TABLE "gift_audit"
  ADD COLUMN "receiverPeiwanId" INTEGER,
  ADD CONSTRAINT "gift_audit_receiver_peiwan_positive"
    CHECK ("receiverPeiwanId" IS NULL OR "receiverPeiwanId" > 0);
