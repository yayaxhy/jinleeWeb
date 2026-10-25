-- Evidence records only. Does not upgrade or backfill historical GiftAudit facts.
CREATE TABLE "gift_audit_review_note" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "giftAuditId" TEXT NOT NULL,
    "individualTransactionId" TEXT NOT NULL,
    "actorDiscordId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gift_audit_review_note_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "gift_audit_review_note_outcome_check" CHECK ("outcome" IN ('NEEDS_EVIDENCE', 'EVIDENCE_ADDED'))
);
CREATE UNIQUE INDEX "gift_audit_review_note_requestId_key" ON "gift_audit_review_note"("requestId");
CREATE INDEX "gift_audit_review_note_giftAuditId_createdAt_id_idx" ON "gift_audit_review_note"("giftAuditId", "createdAt", "id");
ALTER TABLE "gift_audit_review_note" ADD CONSTRAINT "gift_audit_review_note_giftAuditId_fkey"
    FOREIGN KEY ("giftAuditId") REFERENCES "gift_audit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
