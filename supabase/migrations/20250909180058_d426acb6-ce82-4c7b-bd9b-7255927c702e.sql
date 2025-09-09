-- Drop trigger and function in correct order
DROP TRIGGER IF EXISTS trigger_enforce_max_sources_per_draft ON public.postcard_draft_sources;
DROP FUNCTION IF EXISTS public.enforce_max_sources_per_draft();

-- Also remove obsolete functions related to ai_draft_sources table
DROP FUNCTION IF EXISTS public.update_ai_draft_sources_count();