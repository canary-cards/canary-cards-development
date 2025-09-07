-- Insert the manually uploaded zip code SVG into the table
INSERT INTO svg_assets (name, description, file_path)
VALUES ('zip-code-page-icon', 'Zip code page icon', 'zip-code-page-icon.svg')
ON CONFLICT (name) DO UPDATE SET 
  description = EXCLUDED.description,
  file_path = EXCLUDED.file_path,
  updated_at = now();