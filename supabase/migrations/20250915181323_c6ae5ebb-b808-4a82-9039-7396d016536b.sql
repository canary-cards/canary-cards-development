-- Update trigger_production_migration to automatically call Edge Function
CREATE OR REPLACE FUNCTION public.trigger_production_migration()
RETURNS text 
LANGUAGE plpgsql 
SET search_path = 'public'
AS $$
DECLARE
    deployment_id UUID;
    edge_function_response JSONB;
    result TEXT;
BEGIN
    -- Create deployment log entry
    INSERT INTO public.deployment_logs (deployment_type, status, message)
    VALUES ('production_migration', 'pending_execution', 'Production migration initiated - calling Edge Function...')
    RETURNING id INTO deployment_id;

    -- Call the migration-helper Edge Function to execute the deployment
    BEGIN
        SELECT content::jsonb INTO edge_function_response
        FROM http((
            'POST',
            'https://pugnjgvdisdbdkbofwrc.supabase.co/functions/v1/migration-helper',
            ARRAY[
                http_header('Content-Type', 'application/json'),
                http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
            ],
            'application/json',
            json_build_object('action', 'execute_production_deployment', 'deployment_id', deployment_id)::text
        ));

        -- Check if the Edge Function call was successful
        IF edge_function_response->>'success' = 'true' THEN
            result := 'Production deployment executed successfully!' || E'\n' ||
                     'Deployment ID: ' || deployment_id::TEXT || E'\n' ||
                     'Details: ' || (edge_function_response->>'message') || E'\n' ||
                     'Check deployment status with: SELECT * FROM get_deployment_status(5);';
        ELSE
            result := 'Production deployment failed!' || E'\n' ||
                     'Deployment ID: ' || deployment_id::TEXT || E'\n' ||
                     'Error: ' || (edge_function_response->>'error') || E'\n' ||
                     'Check deployment status with: SELECT * FROM get_deployment_status(5);';
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            -- Update deployment log with failure
            UPDATE public.deployment_logs 
            SET status = 'failed', 
                message = 'Failed to call Edge Function: ' || SQLERRM,
                completed_at = now()
            WHERE id = deployment_id;

            result := 'Production deployment setup failed!' || E'\n' ||
                     'Deployment ID: ' || deployment_id::TEXT || E'\n' ||
                     'Error: Could not reach Edge Function - ' || SQLERRM || E'\n' ||
                     'Manual execution required via: fetch("https://pugnjgvdisdbdkbofwrc.supabase.co/functions/v1/migration-helper", {' || E'\n' ||
                     '  method: "POST", headers: {"Content-Type": "application/json"},' || E'\n' ||
                     '  body: JSON.stringify({action: "execute_production_deployment", deployment_id: "' || deployment_id::text || '"})' || E'\n' ||
                     '})';
    END;

    RETURN result;
END;
$$;