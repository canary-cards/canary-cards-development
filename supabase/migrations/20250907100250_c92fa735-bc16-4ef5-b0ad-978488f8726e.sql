-- Fix search_path for normalize_email function
CREATE OR REPLACE FUNCTION public.normalize_email(email_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized_email text;
    local_part text;
    domain_part text;
    plus_position int;
BEGIN
    -- Return null for null input
    IF email_input IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Convert to lowercase and trim whitespace
    normalized_email := lower(trim(email_input));
    
    -- Split email into local and domain parts
    local_part := split_part(normalized_email, '@', 1);
    domain_part := split_part(normalized_email, '@', 2);
    
    -- Return original if no @ found or invalid format
    IF domain_part = '' OR local_part = '' THEN
        RETURN normalized_email;
    END IF;
    
    -- Remove everything after + in local part
    plus_position := position('+' in local_part);
    IF plus_position > 0 THEN
        local_part := substring(local_part from 1 for plus_position - 1);
    END IF;
    
    -- For Gmail domains, remove dots from local part
    IF domain_part IN ('gmail.com', 'googlemail.com') THEN
        local_part := replace(local_part, '.', '');
    END IF;
    
    -- Reconstruct normalized email
    RETURN local_part || '@' || domain_part;
END;
$$;

-- Fix search_path for normalize_customer_email function
CREATE OR REPLACE FUNCTION public.normalize_customer_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.email_normalized := public.normalize_email(NEW.email);
    RETURN NEW;
END;
$$;