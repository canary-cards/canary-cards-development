-- Add database entries for the uploaded SVG assets
INSERT INTO svg_assets (name, description, file_path) VALUES
('Onboard Icon 1 new', 'Onboarding screen 1 icon', 'Onboard Icon 1 new.svg'),
('Onboarding Icon 2 new v 2', 'Onboarding screen 2 icon', 'Onboarding Icon 2 new v 2.svg'),
('Onboarding Icon 3', 'Onboarding screen 3 icon', 'Onboarding Icon 3.svg'),
('Onboarding Icon 4 new', 'Onboarding screen 4 icon', 'Onboarding Icon 4 new.svg')
ON CONFLICT (name) DO UPDATE SET
  file_path = EXCLUDED.file_path,
  description = EXCLUDED.description,
  updated_at = now();