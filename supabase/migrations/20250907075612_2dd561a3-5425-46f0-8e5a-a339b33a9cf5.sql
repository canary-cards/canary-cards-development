-- Fix security issue: Replace permissive public denial with restrictive policy
-- This ensures public access is definitively blocked regardless of other policies

-- Drop the existing permissive public denial policy
DROP POLICY IF EXISTS "customers_deny_public_access" ON public.customers;

-- Create a restrictive policy that definitively denies public access
CREATE POLICY "customers_deny_public_access" ON public.customers
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);

-- Also add restrictive policies to other tables for extra security
-- Even though they already block public access by having no policies,
-- explicit restrictive policies provide clearer security posture

CREATE POLICY "orders_deny_public_access" ON public.orders
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);

CREATE POLICY "postcards_deny_private_access" ON public.postcards
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);

CREATE POLICY "ai_drafts_deny_public_access" ON public.ai_drafts
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);

CREATE POLICY "ai_draft_sources_deny_public_access" ON public.ai_draft_sources
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);