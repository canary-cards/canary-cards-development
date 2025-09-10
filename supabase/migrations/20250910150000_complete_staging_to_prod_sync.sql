-- Complete Staging → Production Schema Sync (Final)
-- Adds missing enum types and values found in staging

-- 1) Add delivery_status enum if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
    CREATE TYPE delivery_status AS ENUM ('submitted','mailed','failed');
  END IF;
END$$;

-- 2) Add recipient_type enum if missing  
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recipient_type') THEN
    CREATE TYPE recipient_type AS ENUM ('representative','senator');
  END IF;
END$$;

-- 3) Add 'paid' value to payment_status enum if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
                 WHERE t.typname = 'payment_status' AND e.enumlabel = 'paid') THEN
    ALTER TYPE payment_status ADD VALUE 'paid';
  END IF;
END$$;

-- 4) Ensure any tables using these enums exist (if they were defined in staging)
-- This is a safety measure to ensure we capture all schema differences

-- Postcards table if it exists in staging
CREATE TABLE IF NOT EXISTS public.postcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  customer_id uuid NULL,
  recipient_type recipient_type NULL,
  delivery_status delivery_status DEFAULT 'submitted',
  updated_at timestamptz DEFAULT now()
);

-- Add any missing triggers for new tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'postcards') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                   WHERE trigger_name = 'update_postcards_updated_at') THEN
      CREATE TRIGGER update_postcards_updated_at 
      BEFORE UPDATE ON public.postcards 
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  END IF;
END$$;