-- Guard background profile/role/join handlers from silently recreating a
-- retired Discord account. Explicit OAuth registration may create a NEW empty
-- identity in a transaction which opts in; no historic ownership is restored.
CREATE OR REPLACE FUNCTION guard_retired_discord_member_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- The migration takes these same identity locks before account/wallet locks.
  -- A late INSERT must recheck retirement after the migration has committed.
  PERFORM pg_advisory_xact_lock(hashtextextended('discord-identity:' || NEW."discordUserId", 0));
  IF EXISTS (
    SELECT 1 FROM "AccountOwnership"
    WHERE "identityKind" = 'DISCORD' AND "identityKey" = NEW."discordUserId"
  ) AND current_setting('app.allow_retired_discord_registration', true) IS DISTINCT FROM 'on'
  AND NOT EXISTS (
    SELECT 1 FROM "DlmUser" d
    JOIN "AccountBinding" b ON b."dlmId" = d."dlmId"
      AND b."provider" = 'DISCORD' AND b."providerUserId" = NEW."discordUserId"
    WHERE d."discordUserId" = NEW."discordUserId"
    AND NOT EXISTS (
      SELECT 1 FROM "AccountOwnership" o
      WHERE o."identityKind" = 'DISCORD' AND o."identityKey" = NEW."discordUserId"
        AND o."originalDlmId" = d."dlmId"
        AND (o."currentDlmId" <> d."dlmId" OR o."currentDiscordId" IS DISTINCT FROM NEW."discordUserId")
    )
  ) THEN
    RAISE EXCEPTION 'discord_identity_retired_register_explicitly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_retired_identity_guard ON "Member";
CREATE TRIGGER member_retired_identity_guard
BEFORE INSERT ON "Member" FOR EACH ROW
EXECUTE FUNCTION guard_retired_discord_member_insert();
