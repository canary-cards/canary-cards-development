-- Extend payment_status enum to include 'refunded' and 'failed'
ALTER TYPE payment_status ADD VALUE 'refunded';
ALTER TYPE payment_status ADD VALUE 'failed';

-- Rename amount_total to amount_paid for clarity
ALTER TABLE public.orders 
RENAME COLUMN amount_total TO amount_paid;

-- Add amount_refunded column with default 0
ALTER TABLE public.orders 
ADD COLUMN amount_refunded INTEGER NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.orders.amount_paid IS 'Amount actually paid by customer (in cents)';
COMMENT ON COLUMN public.orders.amount_refunded IS 'Amount refunded to customer (in cents)';
COMMENT ON COLUMN public.orders.payment_status IS 'Payment status: pending, paid, failed, refunded';