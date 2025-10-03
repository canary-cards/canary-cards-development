-- Add search_path to SECURITY DEFINER functions for best practices
-- deployment_dashboard is a view, not a table, so RLS cannot be applied
-- The underlying deployment_logs table already has proper RLS policies

CREATE OR REPLACE FUNCTION public.update_order_postcard_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_customers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.normalize_customer_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    NEW.email_normalized := public.normalize_email(NEW.email);
    RETURN NEW;
END;
$function$;