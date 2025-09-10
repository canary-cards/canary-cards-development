-- Add unique constraint on customers.email to prevent duplicate customer issues
-- Check if constraint already exists before adding it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'customers_email_unique' 
        AND table_name = 'customers' 
        AND constraint_type = 'UNIQUE'
    ) THEN
        ALTER TABLE public.customers ADD CONSTRAINT customers_email_unique UNIQUE (email);
    END IF;
END $$;
