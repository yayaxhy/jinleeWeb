-- Rename the persisted business identity from Jinlee to DLM without losing history.
-- Existing migration files intentionally retain their original names/checksums.
BEGIN;

DO $$
DECLARE
  entry RECORD;
  replacement TEXT;
BEGIN
  -- Rename every persisted identity column, including composite fields such as
  -- hostJinleeId and consumeTargetJinleeId. This covers schema additions made
  -- by either the web or bot migration histories.
  FOR entry IN
    SELECT table_ns.nspname AS schema_name, table_class.relname AS table_name, attribute.attname AS column_name
    FROM pg_attribute attribute
    JOIN pg_class table_class ON table_class.oid = attribute.attrelid
    JOIN pg_namespace table_ns ON table_ns.oid = table_class.relnamespace
    WHERE table_ns.nspname = current_schema()
      AND table_class.relkind IN ('r', 'p')
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attname ILIKE '%jinlee%'
  LOOP
    replacement := replace(replace(replace(entry.column_name, 'JINLEE', 'DLM'), 'Jinlee', 'Dlm'), 'jinlee', 'dlm');
    IF replacement <> entry.column_name THEN
      EXECUTE format(
        'ALTER TABLE %I.%I RENAME COLUMN %I TO %I',
        entry.schema_name,
        entry.table_name,
        entry.column_name,
        replacement
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE "JinleeUser" RENAME TO "DlmUser";

DO $$
DECLARE
  entry RECORD;
  replacement TEXT;
BEGIN
  -- PostgreSQL preserves index and constraint names when their columns/tables
  -- are renamed, so make the database metadata match the new DLM terminology.
  FOR entry IN
    SELECT table_ns.nspname AS schema_name, table_class.relname AS table_name, constraint_row.conname AS constraint_name
    FROM pg_constraint constraint_row
    JOIN pg_class table_class ON table_class.oid = constraint_row.conrelid
    JOIN pg_namespace table_ns ON table_ns.oid = table_class.relnamespace
    WHERE table_ns.nspname = current_schema()
      AND constraint_row.conname ILIKE '%jinlee%'
  LOOP
    replacement := replace(replace(replace(entry.constraint_name, 'JINLEE', 'DLM'), 'Jinlee', 'Dlm'), 'jinlee', 'dlm');
    IF replacement <> entry.constraint_name THEN
      EXECUTE format(
        'ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I',
        entry.schema_name,
        entry.table_name,
        entry.constraint_name,
        replacement
      );
    END IF;
  END LOOP;

  FOR entry IN
    SELECT index_ns.nspname AS schema_name, index_class.relname AS index_name
    FROM pg_class index_class
    JOIN pg_namespace index_ns ON index_ns.oid = index_class.relnamespace
    WHERE index_ns.nspname = current_schema()
      AND index_class.relkind = 'i'
      AND index_class.relname ILIKE '%jinlee%'
  LOOP
    replacement := replace(replace(replace(entry.index_name, 'JINLEE', 'DLM'), 'Jinlee', 'Dlm'), 'jinlee', 'dlm');
    IF replacement <> entry.index_name THEN
      EXECUTE format('ALTER INDEX %I.%I RENAME TO %I', entry.schema_name, entry.index_name, replacement);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  -- The identity primary key is referenced by many tables. Require cascading
  -- updates before changing its values so no historical row can be orphaned.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint foreign_key
    JOIN pg_class referenced_table ON referenced_table.oid = foreign_key.confrelid
    JOIN pg_namespace referenced_ns ON referenced_ns.oid = referenced_table.relnamespace
    WHERE foreign_key.contype = 'f'
      AND referenced_ns.nspname = current_schema()
      AND referenced_table.relname = 'DlmUser'
      AND foreign_key.confupdtype <> 'c'
  ) THEN
    RAISE EXCEPTION 'DLM identity migration requires ON UPDATE CASCADE for every foreign key referencing DlmUser';
  END IF;
END $$;

-- Convert only the generated legacy prefix. The primary-key update cascades
-- into every relational reference in the same transaction.
UPDATE "DlmUser"
SET "dlmId" = 'dlm' || substring("dlmId" FROM 3)
WHERE "dlmId" LIKE 'ju%';

COMMIT;
