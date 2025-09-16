-- Migration to properly remove all svg_assets references
-- This handles the manual deletion that was done outside of migrations

BEGIN;

-- Drop any remaining svg_assets tables
DROP TABLE IF EXISTS public.svg_assets CASCADE;
DROP TABLE IF EXISTS svg_assets CASCADE;

-- Remove storage bucket if it exists
DELETE FROM storage.buckets WHERE id = 'svg-assets';

-- Remove any related storage policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname LIKE '%svg-assets%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- Add comment explaining the removal
COMMENT ON SCHEMA public IS 'svg_assets table and related functionality have been permanently removed';

COMMIT;
