-- Fix critical security issue: Add RLS policies to protect customer PII

-- CUSTOMERS table policies (CRITICAL - contains PII)
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

-- Add auth_user_id column for future authentication linking (must come before policy that references it)
ALTER TABLE public.customers 
ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Policy 3: Prepare for future authentication - users can only see their own data
-- Note: This will only work when authentication is implemented
CREATE POLICY "customers_own_data_access" ON public.customers
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text IN (
    SELECT auth_user_id::text FROM public.customers WHERE id = customers.id
  ));

-- AI_DRAFTS table policies
CREATE POLICY "ai_drafts_service_role_access" ON public.ai_drafts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- AI_DRAFT_SOURCES table policies  
CREATE POLICY "ai_draft_sources_service_role_access" ON public.ai_draft_sources
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ORDERS table policies
CREATE POLICY "orders_service_role_access" ON public.orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- POSTCARDS table policies
CREATE POLICY "postcards_service_role_access" ON public.postcards
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index on new auth_user_id column for performance
CREATE INDEX idx_customers_auth_user_id ON public.customers(auth_user_id) WHERE auth_user_id IS NOT NULL;