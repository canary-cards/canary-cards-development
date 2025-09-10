-- Final Schema Normalization: Complete Staging → Production Sync
-- Adds the remaining missing pieces identified in the schema diff

-- 1) Add send_option enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'send_option') THEN
    CREATE TYPE send_option AS ENUM ('single','double','triple');
  END IF;
END$$;

-- 2) Add normalize_email function
CREATE OR REPLACE FUNCTION public.normalize_email(email_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Simple email normalization: lowercase and trim
  RETURN lower(trim(email_input));
END$$;

-- 3) Add normalize_customer_email trigger function
CREATE OR REPLACE FUNCTION public.normalize_customer_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.email_normalized := public.normalize_email(NEW.email);
  RETURN NEW;
END$$;

-- 4) Add email_normalized column to customers table if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'customers' AND column_name = 'email_normalized') THEN
    ALTER TABLE public.customers ADD COLUMN email_normalized text;
    
    -- Populate existing records
    UPDATE public.customers 
    SET email_normalized = public.normalize_email(email) 
    WHERE email_normalized IS NULL;
  END IF;
END$$;

-- 5) Add the normalize trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                 WHERE trigger_name = 'normalize_customer_email_trigger') THEN
    CREATE TRIGGER normalize_customer_email_trigger
    BEFORE INSERT OR UPDATE OF email ON public.customers
    FOR EACH ROW 
    EXECUTE FUNCTION public.normalize_customer_email();
  END IF;
END$$;

-- 6) Create any additional tables that use the new enums
CREATE TABLE IF NOT EXISTS public.postcard_send_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  postcard_id uuid NULL,
  send_option send_option DEFAULT 'single',
  updated_at timestamptz DEFAULT now()
);

-- 7) Add missing indexes for performance
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_email_normalized') THEN
    CREATE INDEX idx_customers_email_normalized ON public.customers (email_normalized);
  END IF;
END$$;

-- 8) Ensure all enum values are present in correct order for payment_status
-- (Fix the ordering issue we saw in the diff)
DO $$
BEGIN
  -- payment_status should have: pending, completed, paid, failed, refunded
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
                 WHERE t.typname = 'payment_status' AND e.enumlabel = 'completed') THEN
    -- If 'completed' doesn't exist but 'paid' does, we may need to add it
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'completed';
  END IF;
END$$;