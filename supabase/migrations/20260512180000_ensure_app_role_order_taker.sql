-- Remote projects that skipped 20260511200000_* fail with:
-- invalid input value for enum app_role: "order_taker"
-- Safe if value already exists (no IF NOT EXISTS required on older Postgres).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
      AND e.enumlabel = 'order_taker'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'order_taker';
  END IF;
END $$;
