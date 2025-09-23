-- Add handwriting font key column to postcards table
ALTER TABLE public.postcards 
ADD COLUMN handwriting_font_key TEXT;