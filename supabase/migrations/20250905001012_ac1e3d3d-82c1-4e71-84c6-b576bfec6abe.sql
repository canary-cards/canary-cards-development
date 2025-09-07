-- Add the new Onboarding icon 3 SVG asset
INSERT INTO svg_assets (name, description, file_path) 
VALUES ('Onboarding icon 3 new', 'Updated robot arm icon for onboarding screen 3 and payment success', 'Onboarding icon 3 new.svg')
ON CONFLICT (name) DO UPDATE SET 
  description = EXCLUDED.description,
  file_path = EXCLUDED.file_path,
  updated_at = now();