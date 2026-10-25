-- Metadata only. This migration does not update any invitation or account.
CREATE TABLE "AuditionLegacyTransition" (
  "requestId" TEXT PRIMARY KEY,
  "inviteId" TEXT NOT NULL UNIQUE,
  "actorDiscordId" TEXT NOT NULL,
  "actorDlmId" TEXT,
  "inputHash" TEXT NOT NULL,
  "previewHash" TEXT NOT NULL,
  "beforeSnapshot" JSONB NOT NULL,
  "afterSnapshot" JSONB NOT NULL,
  "evidenceReference" TEXT NOT NULL,
  "evidenceNote" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditionLegacyTransition_createdAt_idx" ON "AuditionLegacyTransition"("createdAt");
CREATE FUNCTION "reject_audition_legacy_receipt_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audition legacy transition receipts are immutable';
END;
$$;
CREATE TRIGGER "AuditionLegacyTransition_immutable"
BEFORE UPDATE OR DELETE ON "AuditionLegacyTransition"
FOR EACH ROW EXECUTE FUNCTION "reject_audition_legacy_receipt_mutation"();
