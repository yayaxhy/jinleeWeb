-- Only future mutations enqueue tasks. No historical balances/profile timestamps
-- are interpreted as unsent events. This migration is deployment work, never startup DDL.
CREATE TABLE "GuildNotificationOutbox" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "dedupeKey" VARCHAR(255) NOT NULL,
  "recipientDlmId" TEXT, "recipientDiscordId" TEXT,
  "event" VARCHAR(80) NOT NULL, "title" VARCHAR(160) NOT NULL,
  "body" VARCHAR(1000) NOT NULL, "href" VARCHAR(512),
  "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "claimToken" TEXT, "leaseUntil" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "error" VARCHAR(160), "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuildNotificationOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GuildNotificationOutbox_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "GuildNotificationOutbox_status_check" CHECK ("status" IN ('PENDING','PROCESSING','SENT','FAILED','SKIPPED','REQUIRES_REVIEW'))
);
CREATE UNIQUE INDEX "GuildNotificationOutbox_dedupeKey_key" ON "GuildNotificationOutbox"("dedupeKey");
CREATE INDEX "GuildNotificationOutbox_status_nextAttemptAt_createdAt_idx" ON "GuildNotificationOutbox"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "GuildNotificationOutbox_recipientDlmId_createdAt_idx" ON "GuildNotificationOutbox"("recipientDlmId", "createdAt");
CREATE INDEX "GuildNotificationOutbox_recipientDiscordId_createdAt_idx" ON "GuildNotificationOutbox"("recipientDiscordId", "createdAt");

-- Replace the standard legacy trigger functions in place; the old LISTEN
-- processes receive nothing after this commit. Custom-named legacy installations
-- must be mapped to these functions in the reviewed deployment migration.
CREATE OR REPLACE FUNCTION notify_member_recharge() RETURNS trigger AS $$
DECLARE
  delta NUMERIC := COALESCE(NEW."recharge", 0) - COALESCE(OLD."recharge", 0);
  skip TEXT := lower(COALESCE(current_setting('bot.skip_recharge_notify', true), 'false'));
BEGIN
  IF skip IN ('true','on','1') OR delta <= 0 THEN RETURN NEW; END IF;
  INSERT INTO "GuildNotificationOutbox" ("dedupeKey", "recipientDlmId", "recipientDiscordId", "event", "title", "body")
  VALUES ('wallet-change:' || txid_current()::text || ':' || md5(NEW."discordUserId" || ':' || delta::text || ':' || COALESCE(NEW."totalBalance",0)::text),
    (SELECT "dlmId" FROM "DlmUser" WHERE "discordUserId" = NEW."discordUserId"), NEW."discordUserId",
    'BALANCE_INCREASED', '余额已增加',
    '账户余额增加 ' || delta::text || '。变更后余额：' || COALESCE(NEW."totalBalance",0)::text || '。详情请查看原业务流水。')
  ON CONFLICT ("dedupeKey") DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_member_recharge_update ON "Member";
CREATE TRIGGER trigger_member_recharge_update AFTER UPDATE OF "recharge" ON "Member"
  FOR EACH ROW EXECUTE FUNCTION notify_member_recharge();

CREATE OR REPLACE FUNCTION notify_peiwan_profile_change() RETURNS trigger AS $$
BEGIN
  -- Suppression also applies to inserts, so fixtures and approved account
  -- migrations cannot accidentally notify an archived/temporary identity.
  IF lower(COALESCE(current_setting('app.suppress_peiwan_notifications', true), 'off')) IN ('on','true','1') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NOT (
    OLD."PEIWANID" IS DISTINCT FROM NEW."PEIWANID" OR OLD."discordUserId" IS DISTINCT FROM NEW."discordUserId" OR
    OLD."defaultQuotationCode" IS DISTINCT FROM NEW."defaultQuotationCode" OR OLD."quotation_Q1" IS DISTINCT FROM NEW."quotation_Q1" OR
    OLD."lolPrice" IS DISTINCT FROM NEW."lolPrice" OR OLD."valPrice" IS DISTINCT FROM NEW."valPrice" OR
    OLD."deltaPrice" IS DISTINCT FROM NEW."deltaPrice" OR OLD."csgoPrice" IS DISTINCT FROM NEW."csgoPrice" OR
    OLD."narakaPrice" IS DISTINCT FROM NEW."narakaPrice" OR OLD."apexPrice" IS DISTINCT FROM NEW."apexPrice" OR
    OLD."owPrice" IS DISTINCT FROM NEW."owPrice" OR OLD."tftPrice" IS DISTINCT FROM NEW."tftPrice" OR
    OLD."steamPrice" IS DISTINCT FROM NEW."steamPrice" OR OLD."commissionRate" IS DISTINCT FROM NEW."commissionRate" OR
    OLD."MP_url" IS DISTINCT FROM NEW."MP_url" OR OLD."voicePreviewUrl" IS DISTINCT FROM NEW."voicePreviewUrl" OR
    OLD."voicePreviewFilename" IS DISTINCT FROM NEW."voicePreviewFilename" OR OLD."exclusive" IS DISTINCT FROM NEW."exclusive" OR
    OLD."level" IS DISTINCT FROM NEW."level"
  ) THEN RETURN NEW; END IF;
  INSERT INTO "GuildNotificationOutbox" ("dedupeKey", "recipientDlmId", "recipientDiscordId", "event", "title", "body")
  VALUES ('peiwan-profile:' || txid_current()::text || ':' || NEW."PEIWANID"::text || ':' || NEW."discordUserId",
    (SELECT "dlmId" FROM "DlmUser" WHERE "discordUserId" = NEW."discordUserId"), NEW."discordUserId",
    'PEIWAN_PROFILE_UPDATED', '陪玩资料已更新', '陪玩 ID ' || NEW."PEIWANID"::text || ' 已更新，您的信息已经注册完毕')
  ON CONFLICT ("dedupeKey") DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_peiwan_profile_upsert ON "PEIWAN";
CREATE TRIGGER trigger_peiwan_profile_upsert AFTER INSERT OR UPDATE ON "PEIWAN"
  FOR EACH ROW EXECUTE FUNCTION notify_peiwan_profile_change();
