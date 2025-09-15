-- Fix: Move HTTP extension out of public schema
-- Drop the extension from public schema and recreate it properly
DROP EXTENSION IF EXISTS http;

-- Create a dedicated schema for extensions (if it doesn't exist)
CREATE SCHEMA IF NOT EXISTS extensions;

-- Create the HTTP extension in the extensions schema
CREATE EXTENSION IF NOT EXISTS http SCHEMA extensions;