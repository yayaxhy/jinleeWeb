-- Restore the original recharge-listener default body without changing task delivery.
-- Existing queue records and published administrator overrides remain untouched.
-- The worker renders this legacy source without a heading; profile headings stay enabled.
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
  original_body := '网站自动充值成功！已为您增加余额 **' || delta::text || '**。当前余额：**' || COALESCE(NEW."totalBalance",0)::text || '**';
  message_title := COALESCE(copy->>'bot.sqlNotifications.balanceTitle', '余额已增加');
  message_body := replace(replace(COALESCE(copy->>'bot.sqlNotifications.balanceBody',
    '网站自动充值成功！已为您增加余额 **{amount}**。当前余额：**{balance}**'),
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
