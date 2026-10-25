-- Only run through the reviewed deployment process; application startup never creates these tables.
CREATE TABLE "EditableCopyConfig" (
  "scope" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "activeVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EditableCopyConfig_pkey" PRIMARY KEY ("scope")
);
CREATE TABLE "EditableCopyVersion" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "overrides" JSONB NOT NULL,
  "actorId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "rollbackOf" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EditableCopyVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EditableCopyVersion_scope_version_key" ON "EditableCopyVersion"("scope", "version");
CREATE INDEX "EditableCopyVersion_scope_createdAt_idx" ON "EditableCopyVersion"("scope", "createdAt");
ALTER TABLE "EditableCopyVersion" ADD CONSTRAINT "EditableCopyVersion_scope_fkey" FOREIGN KEY ("scope") REFERENCES "EditableCopyConfig"("scope") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigger-created notifications capture the published copy in the same business
-- transaction. Existing queued bodies and delivery receipts remain immutable.
-- Installing this migration without publishing any copy retains original text.
CREATE OR REPLACE FUNCTION notify_member_recharge() RETURNS trigger AS $$
DECLARE
  delta NUMERIC := COALESCE(NEW."recharge", 0) - COALESCE(OLD."recharge", 0);
  skip TEXT := lower(COALESCE(current_setting('bot.skip_recharge_notify', true), 'false'));
  copy JSONB;
  message_title TEXT;
  message_body TEXT;
  original_body TEXT;
BEGIN
  IF skip IN ('true','on','1') OR delta <= 0 THEN RETURN NEW; END IF;
  SELECT v."overrides" INTO copy FROM "EditableCopyConfig" c
    JOIN "EditableCopyVersion" v ON v."scope" = c."scope" AND v."version" = c."activeVersion"
    WHERE c."scope" = 'bot';
  original_body := '账户余额增加 ' || delta::text || '。变更后余额：' || COALESCE(NEW."totalBalance",0)::text || '。详情请查看原业务流水。';
  message_title := COALESCE(copy->>'bot.sqlNotifications.balanceTitle', '余额已增加');
  message_body := replace(replace(COALESCE(copy->>'bot.sqlNotifications.balanceBody',
    '账户余额增加 {amount}。变更后余额：{balance}。详情请查看原业务流水。'),
    '{amount}', delta::text), '{balance}', COALESCE(NEW."totalBalance",0)::text);
  IF length(message_title) > 160 OR length(trim(message_title)) = 0 THEN message_title := '余额已增加'; END IF;
  IF length(message_body) > 1000 OR length(trim(message_body)) = 0 THEN message_body := original_body; END IF;
  INSERT INTO "GuildNotificationOutbox" ("dedupeKey", "recipientDlmId", "recipientDiscordId", "event", "title", "body")
  VALUES ('wallet-change:' || txid_current()::text || ':' || md5(NEW."discordUserId" || ':' || delta::text || ':' || COALESCE(NEW."totalBalance",0)::text),
    (SELECT "dlmId" FROM "DlmUser" WHERE "discordUserId" = NEW."discordUserId"), NEW."discordUserId",
    'BALANCE_INCREASED', message_title, message_body)
  ON CONFLICT ("dedupeKey") DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_peiwan_profile_change() RETURNS trigger AS $$
DECLARE
  copy JSONB;
  message_title TEXT;
  message_body TEXT;
  original_body TEXT;
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
  SELECT v."overrides" INTO copy FROM "EditableCopyConfig" c
    JOIN "EditableCopyVersion" v ON v."scope" = c."scope" AND v."version" = c."activeVersion"
    WHERE c."scope" = 'bot';
  original_body := '陪玩 ID ' || NEW."PEIWANID"::text || ' 已更新，您的信息已经注册完毕';
  message_title := COALESCE(copy->>'bot.sqlNotifications.profileTitle', '陪玩资料已更新');
  message_body := replace(COALESCE(copy->>'bot.sqlNotifications.profileBody',
    '陪玩 ID {peiwanId} 已更新，您的信息已经注册完毕'), '{peiwanId}', NEW."PEIWANID"::text);
  IF length(message_title) > 160 OR length(trim(message_title)) = 0 THEN message_title := '陪玩资料已更新'; END IF;
  IF length(message_body) > 1000 OR length(trim(message_body)) = 0 THEN message_body := original_body; END IF;
  INSERT INTO "GuildNotificationOutbox" ("dedupeKey", "recipientDlmId", "recipientDiscordId", "event", "title", "body")
  VALUES ('peiwan-profile:' || txid_current()::text || ':' || NEW."PEIWANID"::text || ':' || NEW."discordUserId",
    (SELECT "dlmId" FROM "DlmUser" WHERE "discordUserId" = NEW."discordUserId"), NEW."discordUserId",
    'PEIWAN_PROFILE_UPDATED', message_title, message_body)
  ON CONFLICT ("dedupeKey") DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
