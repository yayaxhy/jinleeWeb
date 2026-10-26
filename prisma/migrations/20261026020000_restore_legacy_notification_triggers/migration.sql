-- Forward compatibility for the copy-only release. Preserve notification and
-- financial history; future events return to the existing LISTEN/NOTIFY workers.
-- No pending outbox row is replayed or marked as delivered by this migration.
CREATE OR REPLACE FUNCTION notify_member_recharge() RETURNS trigger AS $$
DECLARE delta numeric;
BEGIN
  IF lower(COALESCE(current_setting('bot.skip_recharge_notify', true), 'off')) IN ('on','true','1') THEN RETURN NEW; END IF;
  delta := COALESCE(NEW."recharge", 0) - COALESCE(OLD."recharge", 0);
  IF delta > 0 THEN
    PERFORM pg_notify('member_recharge_channel', json_build_object(
      'discordId', NEW."discordUserId", 'amount', delta, 'balanceAfter', NEW."totalBalance"
    )::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_member_recharge_update ON "Member";
CREATE TRIGGER trigger_member_recharge_update AFTER UPDATE OF "recharge" ON "Member"
  FOR EACH ROW EXECUTE FUNCTION notify_member_recharge();

CREATE OR REPLACE FUNCTION notify_peiwan_profile_change() RETURNS trigger AS $$
BEGIN
  IF lower(COALESCE(current_setting('app.suppress_peiwan_notifications', true), 'off')) IN ('on','true','1') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NOT (
    OLD."PEIWANID" IS DISTINCT FROM NEW."PEIWANID" OR
    OLD."discordUserId" IS DISTINCT FROM NEW."discordUserId" OR
    OLD."defaultQuotationCode" IS DISTINCT FROM NEW."defaultQuotationCode" OR
    OLD."quotation_Q1" IS DISTINCT FROM NEW."quotation_Q1" OR
    OLD."lolPrice" IS DISTINCT FROM NEW."lolPrice" OR
    OLD."valPrice" IS DISTINCT FROM NEW."valPrice" OR
    OLD."deltaPrice" IS DISTINCT FROM NEW."deltaPrice" OR
    OLD."csgoPrice" IS DISTINCT FROM NEW."csgoPrice" OR
    OLD."narakaPrice" IS DISTINCT FROM NEW."narakaPrice" OR
    OLD."apexPrice" IS DISTINCT FROM NEW."apexPrice" OR
    OLD."owPrice" IS DISTINCT FROM NEW."owPrice" OR
    OLD."tftPrice" IS DISTINCT FROM NEW."tftPrice" OR
    OLD."steamPrice" IS DISTINCT FROM NEW."steamPrice" OR
    OLD."commissionRate" IS DISTINCT FROM NEW."commissionRate" OR
    OLD."MP_url" IS DISTINCT FROM NEW."MP_url" OR
    OLD."voicePreviewUrl" IS DISTINCT FROM NEW."voicePreviewUrl" OR
    OLD."voicePreviewFilename" IS DISTINCT FROM NEW."voicePreviewFilename" OR
    OLD."exclusive" IS DISTINCT FROM NEW."exclusive" OR
    OLD."level" IS DISTINCT FROM NEW."level"
  ) THEN RETURN NEW; END IF;
  PERFORM pg_notify('peiwan_profile_channel', json_build_object(
    'discordId', NEW."discordUserId", 'peiwanId', NEW."PEIWANID"
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_peiwan_profile_upsert ON "PEIWAN";
CREATE TRIGGER trigger_peiwan_profile_upsert AFTER INSERT OR UPDATE ON "PEIWAN"
  FOR EACH ROW EXECUTE FUNCTION notify_peiwan_profile_change();
