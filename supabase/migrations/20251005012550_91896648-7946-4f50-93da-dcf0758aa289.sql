-- Add sharing_link column to customers table
ALTER TABLE public.customers 
ADD COLUMN sharing_link TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_customers_sharing_link ON public.customers(sharing_link);

COMMENT ON COLUMN public.customers.sharing_link IS 'Unique sharing link format: FirstName-LastInitial or FirstName-LastInitial-2';
