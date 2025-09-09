-- Rename ai_draft_id to postcard_draft_id in orders table for consistency
ALTER TABLE public.orders RENAME COLUMN ai_draft_id TO postcard_draft_id;