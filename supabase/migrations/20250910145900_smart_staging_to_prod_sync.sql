-- Smart Staging → Production Schema Sync
-- Generated on: 2025-09-10
-- Handles existing enums and tables gracefully

-- 1) Ensure generation_status enum exists with all needed values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'generation_status') THEN
    CREATE TYPE generation_status AS ENUM ('pending','success','error','approved');
  ELSE
    -- Add missing enum values if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
                   WHERE t.typname = 'generation_status' AND e.enumlabel = 'approved') THEN
      ALTER TYPE generation_status ADD VALUE 'approved';
    END IF;
  END IF;
END$$;

-- 2) Ensure payment_status enum exists with all needed values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending','completed','failed','refunded');
  ELSE
    -- Add missing enum values if they don't exist (safe order)
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
                   WHERE t.typname = 'payment_status' AND e.enumlabel = 'failed') THEN
      ALTER TYPE payment_status ADD VALUE 'failed';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
                   WHERE t.typname = 'payment_status' AND e.enumlabel = 'refunded') THEN
      ALTER TYPE payment_status ADD VALUE 'refunded';
    END IF;
  END IF;
END$$;

-- 3) Ensure postcard_drafts table exists with correct structure
CREATE TABLE IF NOT EXISTS public.postcard_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ai_drafted_message text NULL,
  human_approved_message text NULL,
  generation_status generation_status DEFAULT 'pending',
  api_status_code integer NULL,
  api_status_message text NULL,
  customer_id uuid NULL,
  updated_at timestamptz DEFAULT now()
);

-- 4) Ensure postcard_draft_sources table exists with correct structure  
CREATE TABLE IF NOT EXISTS public.postcard_draft_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  postcard_draft_id uuid NOT NULL,
  source_type text NOT NULL,
  source_data jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 5) Ensure customers table exists with correct structure
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  auth_user_id uuid NULL,
  stripe_customer_id text NULL,
  full_name text NULL,
  updated_at timestamptz DEFAULT now()
);

-- 6) Ensure payments table exists with correct structure
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  customer_id uuid NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status payment_status DEFAULT 'pending',
  stripe_payment_intent_id text NULL,
  description text NULL,
  updated_at timestamptz DEFAULT now()
);

-- 7) Add missing columns to existing tables
DO $$
BEGIN
  -- Add columns to postcard_drafts if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'postcard_drafts' AND column_name = 'generation_status') THEN
    ALTER TABLE public.postcard_drafts ADD COLUMN generation_status generation_status DEFAULT 'pending';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'postcard_drafts' AND column_name = 'api_status_code') THEN
    ALTER TABLE public.postcard_drafts ADD COLUMN api_status_code integer NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'postcard_drafts' AND column_name = 'api_status_message') THEN
    ALTER TABLE public.postcard_drafts ADD COLUMN api_status_message text NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'postcard_drafts' AND column_name = 'customer_id') THEN
    ALTER TABLE public.postcard_drafts ADD COLUMN customer_id uuid NULL;
  END IF;
END$$;

-- 8) Add foreign key constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'postcard_draft_sources_postcard_draft_id_fkey') THEN
    ALTER TABLE public.postcard_draft_sources 
    ADD CONSTRAINT postcard_draft_sources_postcard_draft_id_fkey 
    FOREIGN KEY (postcard_draft_id) REFERENCES public.postcard_drafts(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'payments_customer_id_fkey') THEN
    ALTER TABLE public.payments 
    ADD CONSTRAINT payments_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'postcard_drafts_customer_id_fkey') THEN
    ALTER TABLE public.postcard_drafts 
    ADD CONSTRAINT postcard_drafts_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
END$$;

-- 9) Add unique constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'customers_email_unique') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_email_unique UNIQUE (email);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'customers_auth_user_id_unique') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_auth_user_id_unique UNIQUE (auth_user_id);
  END IF;
END$$;

-- 10) Add indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_auth_user_id') THEN
    CREATE INDEX idx_customers_auth_user_id ON public.customers (auth_user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_postcard_drafts_customer_id') THEN
    CREATE INDEX idx_postcard_drafts_customer_id ON public.postcard_drafts (customer_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_customer_id') THEN
    CREATE INDEX idx_payments_customer_id ON public.payments (customer_id);
  END IF;
END$$;

-- 11) Add updated_at triggers if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                 WHERE trigger_name = 'update_customers_updated_at') THEN
    CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON public.customers 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                 WHERE trigger_name = 'update_postcard_drafts_updated_at') THEN
    CREATE TRIGGER update_postcard_drafts_updated_at 
    BEFORE UPDATE ON public.postcard_drafts 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                 WHERE trigger_name = 'update_postcard_draft_sources_updated_at') THEN
    CREATE TRIGGER update_postcard_draft_sources_updated_at 
    BEFORE UPDATE ON public.postcard_draft_sources 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                 WHERE trigger_name = 'update_payments_updated_at') THEN
    CREATE TRIGGER update_payments_updated_at 
    BEFORE UPDATE ON public.payments 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;