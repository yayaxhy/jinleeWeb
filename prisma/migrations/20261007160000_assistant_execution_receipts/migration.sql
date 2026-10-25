CREATE TABLE "AssistantExecution" (
  "confirmationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actionKind" VARCHAR(40) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'CLAIMED',
  "errorCode" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AssistantExecution_pkey" PRIMARY KEY ("confirmationId")
);
CREATE INDEX "AssistantExecution_userId_createdAt_idx" ON "AssistantExecution"("userId", "createdAt");
CREATE INDEX "AssistantExecution_status_createdAt_idx" ON "AssistantExecution"("status", "createdAt");
