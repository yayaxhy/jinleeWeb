CREATE TABLE "SettlementReversal" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "actorDiscordId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "originalActorId" TEXT,
  "originalAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementReversal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SettlementReversal_kind_targetId_createdAt_idx"
  ON "SettlementReversal"("kind", "targetId", "createdAt");
