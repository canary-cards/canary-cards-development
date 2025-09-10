-- Fix critical security issue: Add RLS policies to protect customer PII
-- This migration handles potential duplicates by dropping existing policies first

-- CUSTOMERS table policies (CRITICAL - contains PII)
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "customers_deny_public_access" ON public.customers;
DROP POLICY IF EXISTS "customers_service_role_access" ON public.customers;
DROP POLICY IF EXISTS "customers_own_data_access" ON public.customers;

-- Policy 1: Deny all public access to customer data
CREATE POLICY "customers_deny_public_access" ON public.customers
  FOR ALL
  USING (false);

-- Policy 2: Allow service role (edge functions) to manage customer records  
CREATE POLICY "customers_service_role_access" ON public.customers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add auth_user_id column for future authentication linking (if not exists)
-- Note: This may already exist from previous migration
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customers' AND column_name = 'auth_user_id') THEN
        ALTER TABLE public.customers 
        ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Policy 3: Allow authenticated users to see their own customer data (future use)
CREATE POLICY "customers_own_data_access" ON public.customers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);


-- Create index on new auth_user_id column for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON public.customers(auth_user_id) WHERE auth_user_id IS NOT NULL;
