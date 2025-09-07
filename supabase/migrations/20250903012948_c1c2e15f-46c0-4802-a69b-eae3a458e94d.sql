-- Create storage bucket for SVG assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('svg-assets', 'svg-assets', true);

-- Create RLS policies for SVG assets
CREATE POLICY "SVG assets are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'svg-assets');

CREATE POLICY "Authenticated users can upload SVG assets" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'svg-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update SVG assets" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'svg-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete SVG assets" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'svg-assets' AND auth.role() = 'authenticated');

-- Create table to manage SVG metadata
CREATE TABLE public.svg_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on svg_assets table
ALTER TABLE public.svg_assets ENABLE ROW LEVEL SECURITY;

-- Create policies for svg_assets table
CREATE POLICY "SVG assets metadata is publicly readable"
ON public.svg_assets
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage SVG assets metadata"
ON public.svg_assets
FOR ALL
USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_svg_assets_updated_at
  BEFORE UPDATE ON public.svg_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial SVG asset records
INSERT INTO public.svg_assets (name, description, file_path) VALUES
  ('onboarding-icon-1', 'Onboarding screen 1 icon', 'onboarding/icon-1.svg'),
  ('onboarding-icon-2', 'Onboarding screen 2 icon', 'onboarding/icon-2.svg'),
  ('onboarding-icon-3', 'Onboarding screen 3 icon', 'onboarding/icon-3.svg'),
  ('onboarding-icon-4', 'Onboarding screen 4 icon', 'onboarding/icon-4.svg');