-- Update trigger_production_migration function to actually execute deployment
CREATE OR REPLACE FUNCTION public.trigger_production_migration()
RETURNS TEXT AS $$
DECLARE
    deployment_id UUID;
    result TEXT;
    function_response TEXT;
BEGIN
    -- Create deployment log entry
    INSERT INTO public.deployment_logs (deployment_type, status, message)
    VALUES ('production_migration', 'started', 'Production migration initiated from dashboard')
    RETURNING id INTO deployment_id;

    -- Call the migration-helper Edge Function to execute the deployment
    SELECT public.http_post(
        url := 'https://pugnjgvdisdbdkbofwrc.supabase.co/functions/v1/migration-helper',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.jwt_token', true) || '"}',
        body := '{"action": "execute_production_deployment", "deployment_id": "' || deployment_id::text || '"}'
    ) INTO function_response;

    result := 'Production deployment initiated successfully!' || E'\n' ||
              'Deployment ID: ' || deployment_id::TEXT || E'\n' ||
              'Status: Check deployment_logs table for progress' || E'\n' ||
              'Query: SELECT * FROM get_deployment_status(5);';

    -- Update log with success message
    UPDATE public.deployment_logs 
    SET status = 'initiated', 
        message = 'Deployment request sent to migration-helper Edge Function'
    WHERE id = deployment_id;

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Update log with error
        UPDATE public.deployment_logs 
        SET status = 'failed', 
            message = 'Failed to initiate deployment: ' || SQLERRM,
            completed_at = now()
        WHERE id = deployment_id;
        
        RETURN 'Deployment failed: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SET search_path = public;