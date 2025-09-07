-- Create enums
CREATE TYPE recipient_type AS ENUM ('representative', 'senator');
CREATE TYPE send_option AS ENUM ('single', 'double', 'triple');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE delivery_status AS ENUM ('submitted', 'mailed', 'failed');

-- Create AI_DRAFTS table
CREATE TABLE public.ai_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invite_code TEXT,
  zip_code TEXT NOT NULL,
  concerns TEXT,
  personal_impact TEXT,
  ai_drafted_message TEXT NOT NULL,
  human_approved_message TEXT,
  recipient_type recipient_type NOT NULL,
  recipient_snapshot JSONB NOT NULL,
  sources_count SMALLINT NOT NULL DEFAULT 0,
  sent_order_id UUID
);

-- Create AI_DRAFT_SOURCES table
CREATE TABLE public.ai_draft_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_draft_id UUID NOT NULL REFERENCES public.ai_drafts(id) ON DELETE CASCADE,
  ordinal SMALLINT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  data_point_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(ai_draft_id, ordinal)
);

-- Create CUSTOMERS table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  raw_address_text TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  parsed_via TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique index on lowercase email for customers
CREATE UNIQUE INDEX idx_customers_email_lower ON public.customers (lower(email));

-- Create ORDERS table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ai_draft_id UUID REFERENCES public.ai_drafts(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  email_for_receipt TEXT NOT NULL,
  send_option send_option NOT NULL,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  amount_total INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  postcard_count SMALLINT NOT NULL DEFAULT 0,
  metadata_snapshot JSONB
);

-- Create unique indexes for Stripe IDs
CREATE UNIQUE INDEX idx_orders_stripe_session_id ON public.orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE UNIQUE INDEX idx_orders_stripe_payment_intent_id ON public.orders (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- Create POSTCARDS table
CREATE TABLE public.postcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient_type recipient_type NOT NULL,
  recipient_snapshot JSONB NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_title TEXT,
  recipient_office_address TEXT,
  recipient_district_info TEXT,
  postcard_front_image TEXT,
  message_text TEXT NOT NULL,
  ignitepost_template_id TEXT,
  ignitepost_order_id TEXT,
  ignitepost_send_on DATE,
  ignitepost_created_at TIMESTAMPTZ,
  ignitepost_error TEXT,
  sender_snapshot JSONB NOT NULL,
  delivery_status delivery_status NOT NULL DEFAULT 'submitted',
  mailed_at TIMESTAMPTZ,
  webhook_received_at TIMESTAMPTZ,
  delivery_metadata JSONB
);

-- Add foreign key from ai_drafts to orders (after orders table is created)
ALTER TABLE public.ai_drafts 
ADD CONSTRAINT fk_ai_drafts_sent_order_id 
FOREIGN KEY (sent_order_id) REFERENCES public.orders(id);

-- Create performance indexes
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_ai_draft_id ON public.orders(ai_draft_id) WHERE ai_draft_id IS NOT NULL;
CREATE INDEX idx_postcards_order_id ON public.postcards(order_id);
CREATE INDEX idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX idx_postcards_delivery_status ON public.postcards(delivery_status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);
CREATE INDEX idx_postcards_mailed_at ON public.postcards(mailed_at) WHERE mailed_at IS NOT NULL;
CREATE INDEX idx_ai_draft_sources_ai_draft_id ON public.ai_draft_sources(ai_draft_id);

-- Create function to update sources_count on ai_drafts
CREATE OR REPLACE FUNCTION public.update_ai_draft_sources_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.ai_drafts 
    SET sources_count = sources_count + 1 
    WHERE id = NEW.ai_draft_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.ai_drafts 
    SET sources_count = sources_count - 1 
    WHERE id = OLD.ai_draft_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for sources_count maintenance
CREATE TRIGGER trigger_update_ai_draft_sources_count
  AFTER INSERT OR DELETE ON public.ai_draft_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_draft_sources_count();

-- Create function to enforce max 4 sources per draft
CREATE OR REPLACE FUNCTION public.enforce_max_sources_per_draft()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.ai_draft_sources WHERE ai_draft_id = NEW.ai_draft_id) > 4 THEN
    RAISE EXCEPTION 'Maximum of 4 sources allowed per AI draft';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to enforce max sources
CREATE TRIGGER trigger_enforce_max_sources_per_draft
  BEFORE INSERT ON public.ai_draft_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_sources_per_draft();

-- Create function to update postcard_count on orders
CREATE OR REPLACE FUNCTION public.update_order_postcard_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.orders 
    SET postcard_count = postcard_count + 1 
    WHERE id = NEW.order_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.orders 
    SET postcard_count = postcard_count - 1 
    WHERE id = OLD.order_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for postcard_count maintenance
CREATE TRIGGER trigger_update_order_postcard_count
  AFTER INSERT OR DELETE ON public.postcards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_postcard_count();

-- Create function to update updated_at on customers
CREATE OR REPLACE FUNCTION public.update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for customers updated_at
CREATE TRIGGER trigger_update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customers_updated_at();

-- Enable Row Level Security on all tables
ALTER TABLE public.ai_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_draft_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postcards ENABLE ROW LEVEL SECURITY;

-- Create minimal RLS policies (edge functions will use service role)
-- No public policies - all access through edge functions with service role