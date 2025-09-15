-- Fix trigger_production_migration function to work without HTTP calls
-- Since database functions can't make HTTP calls, we'll use a different approach
CREATE OR REPLACE FUNCTION public.trigger_production_migration()
RETURNS TEXT AS $$
DECLARE
    deployment_id UUID;
    result TEXT;
BEGIN
    -- Create deployment log entry with special status to trigger Edge Function
    INSERT INTO public.deployment_logs (deployment_type, status, message)
    VALUES ('production_migration', 'pending_execution', 'Production migration queued - call Edge Function to execute')
    RETURNING id INTO deployment_id;

    result := 'Production deployment queued successfully!' || E'\n' ||
              'Deployment ID: ' || deployment_id::TEXT || E'\n' ||
              E'\nTo execute the deployment, run this in your browser console or API client:' || E'\n' ||
              'fetch("https://pugnjgvdisdbdkbofwrc.supabase.co/functions/v1/migration-helper", {' || E'\n' ||
              '  method: "POST",' || E'\n' ||
              '  headers: { "Content-Type": "application/json" },' || E'\n' ||
              '  body: JSON.stringify({' || E'\n' ||
              '    action: "execute_production_deployment",' || E'\n' ||
              '    deployment_id: "' || deployment_id::text || '"' || E'\n' ||
              '  })' || E'\n' ||
              '})' || E'\n' ||
              E'\nOr check status with: SELECT * FROM get_deployment_status(5);';

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN        
        RETURN 'Deployment setup failed: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SET search_path = public;