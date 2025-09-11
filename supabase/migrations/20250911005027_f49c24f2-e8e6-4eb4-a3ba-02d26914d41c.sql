-- Make postcard_drafts fields optional since we only have minimal data at draft creation
ALTER TABLE public.postcard_drafts 
ALTER COLUMN zip_code DROP NOT NULL,
ALTER COLUMN recipient_snapshot DROP NOT NULL,
ALTER COLUMN recipient_type DROP NOT NULL;