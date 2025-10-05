-- Add frontend_url column to orders table to store the URL of the frontend environment
-- This allows email links to point to the correct environment (dev/staging/prod)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS frontend_url text;