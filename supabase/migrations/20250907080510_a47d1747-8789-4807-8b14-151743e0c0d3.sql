-- Add unique constraint on customers.email to prevent duplicate customer issues
-- Using a simple approach without CONCURRENTLY since we're in a transaction block
ALTER TABLE public.customers ADD CONSTRAINT customers_email_unique UNIQUE (email);