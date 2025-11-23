-- Align Withdraw_id_seq with existing data (ensure sequence exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'Withdraw_id_seq'
  ) THEN
    CREATE SEQUENCE "Withdraw_id_seq";
  END IF;
END $$;

WITH max_val AS (
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(id, '^W', '') AS INTEGER)), 0) AS max_id
  FROM "Withdraw"
)
SELECT setval('Withdraw_id_seq', (SELECT max_id FROM max_val));

ALTER TABLE "Withdraw"
  ALTER COLUMN "id"
  SET DEFAULT concat('W', nextval('"Withdraw_id_seq"'::regclass));
