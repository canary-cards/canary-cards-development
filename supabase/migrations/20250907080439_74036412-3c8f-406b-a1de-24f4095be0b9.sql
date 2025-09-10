-- Add unique constraint on customers.email to prevent duplicate customer issues
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS customers_email_unique_idx ON public.customers (email);

-- Add the unique constraint using the index
ALTER TABLE public.customers ADD CONSTRAINT customers_email_unique UNIQUE USING INDEX customers_email_unique_idx;