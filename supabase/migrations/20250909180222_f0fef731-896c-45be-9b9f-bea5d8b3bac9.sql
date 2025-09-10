-- Drop all triggers and functions in correct order
DROP TRIGGER IF EXISTS trigger_update_ai_draft_sources_count ON public.postcard_draft_sources;
DROP TRIGGER IF EXISTS trigger_enforce_max_sources_per_draft ON public.postcard_draft_sources;
DROP FUNCTION IF EXISTS public.enforce_max_sources_per_draft();
DROP FUNCTION IF EXISTS public.update_ai_draft_sources_count();