-- Insert the correct zip code SVG entry
INSERT INTO svg_assets (name, description, file_path)
VALUES ('zip-code-page-icon-2', 'Zip code page icon 2', 'zip code page icon 2.svg')
ON CONFLICT (name) DO UPDATE SET 
  description = EXCLUDED.description,
  file_path = EXCLUDED.file_path,
  updated_at = now();