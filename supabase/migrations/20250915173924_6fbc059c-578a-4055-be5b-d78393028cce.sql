-- Fix Security Definer View Issue
-- The deployment_dashboard view is owned by postgres superuser, which can bypass RLS
-- This migration recreates the view to ensure proper security

-- Drop the existing view
DROP VIEW IF EXISTS public.deployment_dashboard;

-- Recreate the view with explicit security model
-- Using a regular view that respects RLS policies
CREATE VIEW public.deployment_dashboard 
WITH (security_invoker = true)  -- Explicitly set security invoker mode
AS 
SELECT 
    id AS deployment_id,
    created_at,
    deployment_type,
    status,
    CASE
        WHEN (length(message) > 100) THEN (left(message, 100) || '...'::text)
        ELSE message
    END AS summary,
    completed_at,
    CASE
        WHEN (completed_at IS NOT NULL) THEN EXTRACT(epoch FROM (completed_at - created_at))
        ELSE EXTRACT(epoch FROM (now() - created_at))
    END AS duration_seconds
FROM deployment_logs
ORDER BY created_at DESC;

-- Ensure the view has proper ownership
-- Note: The view will now respect RLS policies on the underlying deployment_logs table

-- Add a comment explaining the security model
COMMENT ON VIEW public.deployment_dashboard IS 
'Dashboard view for deployment logs. Uses security_invoker=true to respect RLS policies of the calling user.';

-- Verify that the existing RLS policies on deployment_logs are sufficient
-- The deployment_logs table already has these policies:
-- 1. deployment_logs_deny_public (denies all public access)
-- 2. deployment_logs_service_access (allows service role full access)
-- 3. deployment_dashboard_service_access (allows service role SELECT access)

-- This means the view will only be accessible to:
-- 1. Service role users (via deployment_logs_service_access policy)
-- 2. Users with explicit permissions via future policies

-- The security_invoker=true option ensures that the view executes with
-- the privileges of the user calling it, not the view owner, which prevents
-- privilege escalation through view ownership.