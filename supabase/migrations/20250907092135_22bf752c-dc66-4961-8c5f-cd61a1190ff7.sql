-- Make generation_status nullable and remove default so manual drafts don't set it
ALTER TABLE public.postcard_drafts
  ALTER COLUMN generation_status DROP DEFAULT,
  ALTER COLUMN generation_status DROP NOT NULL;

-- Backfill: clear generation_status for existing manual drafts (identified by missing invite_code and no AI message)
UPDATE public.postcard_drafts
SET generation_status = NULL
WHERE invite_code IS NULL
  AND ai_drafted_message IS NULL
  AND generation_status = 'pending';