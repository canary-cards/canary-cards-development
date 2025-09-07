-- Check current enum values and add missing ones
DO $$
BEGIN
    -- Add 'failed' if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'failed' AND enumtypid = 'payment_status'::regtype) THEN
        ALTER TYPE payment_status ADD VALUE 'failed';
    END IF;
    
    -- Add 'refunded' if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'refunded' AND enumtypid = 'payment_status'::regtype) THEN
        ALTER TYPE payment_status ADD VALUE 'refunded';
    END IF;
END
$$;

-- Rename amount_total to amount_paid for clarity
ALTER TABLE public.orders 
RENAME COLUMN amount_total TO amount_paid;

-- Add amount_refunded column with default 0
ALTER TABLE public.orders 
ADD COLUMN amount_refunded INTEGER NOT NULL DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN public.orders.amount_paid IS 'Amount actually paid by customer (in cents)';
COMMENT ON COLUMN public.orders.amount_refunded IS 'Amount refunded to customer (in cents)';
COMMENT ON COLUMN public.orders.payment_status IS 'Payment status: pending, paid, failed, refunded';