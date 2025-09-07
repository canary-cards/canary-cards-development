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

-- Add auth_user_id column for future authentication linking
ALTER TABLE public.customers 
ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Policy 3: Allow authenticated users to see their own customer data (future use)
CREATE POLICY "customers_own_data_access" ON public.customers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- AI_DRAFTS table policies - no public access, service role only
CREATE POLICY "ai_drafts_service_role_access" ON public.ai_drafts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- AI_DRAFT_SOURCES table policies - no public access, service role only
CREATE POLICY "ai_draft_sources_service_role_access" ON public.ai_draft_sources
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ORDERS table policies - no public access, service role only
CREATE POLICY "orders_service_role_access" ON public.orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- POSTCARDS table policies - no public access, service role only
CREATE POLICY "postcards_service_role_access" ON public.postcards
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index on new auth_user_id column for performance
CREATE INDEX idx_customers_auth_user_id ON public.customers(auth_user_id) WHERE auth_user_id IS NOT NULL;