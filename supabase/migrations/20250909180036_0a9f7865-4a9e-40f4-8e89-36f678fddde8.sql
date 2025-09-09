-- Remove the database constraint that enforces max 4 sources per draft
-- and remove the obsolete trigger function
DROP TRIGGER IF EXISTS enforce_max_sources_per_draft_trigger ON public.postcard_draft_sources;
DROP FUNCTION IF EXISTS public.enforce_max_sources_per_draft();

-- Also remove the obsolete update_ai_draft_sources_count function and related triggers since we're using postcard_draft_sources now
DROP TRIGGER IF EXISTS update_ai_draft_sources_count_trigger ON public.ai_draft_sources;
DROP FUNCTION IF EXISTS public.update_ai_draft_sources_count();