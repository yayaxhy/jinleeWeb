-- A linked Member is the source of truth for its DlmUser wallet mirror.
-- This does not create Recharge or IndividualTransaction records: those
-- business events must still be recorded by the caller.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.sync_member_wallet_to_dlm_user()
RETURNS trigger AS $$
BEGIN
  UPDATE "DlmUser" AS d
     SET "income" = NEW."income",
         "recharge" = NEW."recharge",
         "totalBalance" = NEW."totalBalance",
         "totalSpent" = NEW."totalSpent",
         "updatedAt" = CURRENT_TIMESTAMP
   WHERE d."discordUserId" = NEW."discordUserId"
     AND (
       d."income" IS DISTINCT FROM NEW."income"
       OR d."recharge" IS DISTINCT FROM NEW."recharge"
       OR d."totalBalance" IS DISTINCT FROM NEW."totalBalance"
       OR d."totalSpent" IS DISTINCT FROM NEW."totalSpent"
     );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "member_wallet_mirror_to_dlm_user" ON "Member";

CREATE TRIGGER "member_wallet_mirror_to_dlm_user"
AFTER UPDATE OF "income", "recharge", "totalBalance", "totalSpent" ON "Member"
FOR EACH ROW
WHEN (
  OLD."income" IS DISTINCT FROM NEW."income"
  OR OLD."recharge" IS DISTINCT FROM NEW."recharge"
  OR OLD."totalBalance" IS DISTINCT FROM NEW."totalBalance"
  OR OLD."totalSpent" IS DISTINCT FROM NEW."totalSpent"
)
EXECUTE FUNCTION public.sync_member_wallet_to_dlm_user();

COMMIT;
