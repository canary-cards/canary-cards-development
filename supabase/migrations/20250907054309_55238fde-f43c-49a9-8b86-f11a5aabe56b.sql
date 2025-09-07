-- Clean up svg_assets table remnants
-- Drop the table if it still exists (safe operation)
DROP TABLE IF EXISTS public.svg_assets CASCADE;

-- Drop the trigger function if it exists
DROP FUNCTION IF EXISTS public.set_updated_at CASCADE;