-- Rename ai_draft_id to postcard_draft_id in postcard_draft_sources table for consistency
ALTER TABLE public.postcard_draft_sources RENAME COLUMN ai_draft_id TO postcard_draft_id;