-- CRITICAL: Missing RLS Policies Fix for Production
-- This migration adds the essential RLS policies that are missing in production
-- Without these, data operations fail due to missing security policies

-- Enable RLS on all tables first
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.postcard_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postcard_draft_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postcards ENABLE ROW LEVEL SECURITY;

-- Customers table policies
CREATE POLICY "customers_deny_public_access" ON public.customers AS RESTRICTIVE USING (false);
CREATE POLICY "customers_own_data_access" ON public.customers FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
CREATE POLICY "customers_service_role_access" ON public.customers TO service_role USING (true) WITH CHECK (true);

-- Orders table policies
CREATE POLICY "orders_deny_public_access" ON public.orders AS RESTRICTIVE USING (false);
CREATE POLICY "orders_service_role_access" ON public.orders TO service_role USING (true) WITH CHECK (true);

-- Postcard drafts policies
CREATE POLICY "postcard_drafts_deny_public_access" ON public.postcard_drafts USING (false) WITH CHECK (false);
CREATE POLICY "ai_drafts_deny_public_access" ON public.postcard_drafts AS RESTRICTIVE USING (false);
CREATE POLICY "ai_drafts_service_role_access" ON public.postcard_drafts TO service_role USING (true) WITH CHECK (true);

-- Postcard draft sources policies  
CREATE POLICY "postcard_draft_sources_deny_public_access" ON public.postcard_draft_sources USING (false) WITH CHECK (false);
CREATE POLICY "ai_draft_sources_deny_public_access" ON public.postcard_draft_sources AS RESTRICTIVE USING (false);
CREATE POLICY "ai_draft_sources_service_role_access" ON public.postcard_draft_sources TO service_role USING (true) WITH CHECK (true);

-- Postcards policies
CREATE POLICY "postcards_deny_private_access" ON public.postcards AS RESTRICTIVE USING (false);
CREATE POLICY "postcards_service_role_access" ON public.postcards TO service_role USING (true) WITH CHECK (true);

-- Ensure payments table also has proper constraints if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'payments_customer_id_fkey') THEN
    ALTER TABLE public.payments 
    ADD CONSTRAINT payments_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
  END IF;
END$$;