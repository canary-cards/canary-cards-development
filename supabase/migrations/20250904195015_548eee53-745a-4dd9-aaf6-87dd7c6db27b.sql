-- Create the svg-assets storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('svg-assets', 'svg-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the svg-assets bucket to allow uploads
CREATE POLICY "Allow public uploads to svg-assets bucket" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'svg-assets');

CREATE POLICY "Allow public access to svg-assets bucket" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'svg-assets');

CREATE POLICY "Allow public updates to svg-assets bucket" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'svg-assets');

CREATE POLICY "Allow public deletes from svg-assets bucket" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'svg-assets');