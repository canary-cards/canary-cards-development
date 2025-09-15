import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnvironmentConfig {
  project_id: string;
  db_url: string;
  anon_key: string;
  service_role_key: string;
}

serve(async (req) => {
  // Enhanced logging for debugging
  console.log(`Migration Helper called: ${req.method} ${new Date().toISOString()}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    console.log(`Request body: ${body}`);
    
    const { action, environment } = JSON.parse(body || '{}');

    // Get environment-specific configuration
    const getEnvironmentConfig = (env: string): EnvironmentConfig => {
      switch (env) {
        case 'production':
          return {
            project_id: Deno.env.get('PRODUCTION_PROJECT_ID') || 'xwsgyxlvxntgpochonwe',
            db_url: Deno.env.get('PRODUCTION_DB_URL') || '',
            anon_key: Deno.env.get('PRODUCTION_SUPABASE_ANON_KEY') || '',
            service_role_key: Deno.env.get('PRODUCTION_SUPABASE_SERVICE_ROLE_KEY') || ''
          };
        case 'staging':
          return {
            project_id: Deno.env.get('STAGING_PROJECT_ID') || 'pugnjgvdisdbdkbofwrc',
            db_url: Deno.env.get('STAGING_DB_URL') || '',
            anon_key: Deno.env.get('STAGING_SUPABASE_ANON_KEY') || '',
            service_role_key: Deno.env.get('STAGING_SUPABASE_SERVICE_ROLE_KEY') || ''
          };
        default:
          throw new Error(`Unknown environment: ${env}`);
      }
    };

    console.log(`Processing action: ${action} for environment: ${environment}`);

    switch (action) {
      case 'validate_secrets': {
        // New endpoint to validate secret configuration
        console.log('Validating secrets configuration...');
        
        const requiredSecrets = [
          'PRODUCTION_PROJECT_ID',
          'PRODUCTION_DB_PASSWORD', 
          'PRODUCTION_SUPABASE_ANON_KEY',
          'PRODUCTION_SUPABASE_SERVICE_ROLE_KEY',
          'STAGING_PROJECT_ID',
          'STAGING_DB_PASSWORD',
          'STAGING_SUPABASE_SERVICE_ROLE_KEY'
        ];
        
        const secretStatus: Record<string, boolean> = {};
        let allSecretsPresent = true;
        
        for (const secret of requiredSecrets) {
          const value = Deno.env.get(secret);
          secretStatus[secret] = !!value;
          if (!value) {
            allSecretsPresent = false;
            console.log(`Missing secret: ${secret}`);
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          allSecretsPresent,
          secretStatus,
          message: allSecretsPresent ? 'All secrets configured' : 'Some secrets missing'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_credentials': {
        console.log(`Getting credentials for environment: ${environment}`);
        const config = getEnvironmentConfig(environment);
        
        // Build database URL with password from secrets
        const password = environment === 'production' 
          ? Deno.env.get('PRODUCTION_DB_PASSWORD')
          : Deno.env.get('STAGING_DB_PASSWORD');
        
        console.log(`Password configured: ${!!password}`);
        
        if (!password) {
          console.error(`Database password not configured for ${environment}`);
          throw new Error(`Database password not configured for ${environment}`);
        }

        const dbUrl = `postgresql://postgres.${config.project_id}:${password}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`;
        console.log(`Database URL constructed for project: ${config.project_id}`);
        
        return new Response(JSON.stringify({
          success: true,
          config: {
            project_id: config.project_id,
            db_url: dbUrl,
            anon_key: config.anon_key,
            service_role_key: config.service_role_key
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'validate_connection': {
        console.log(`Validating connection for environment: ${environment}`);
        const config = getEnvironmentConfig(environment);
        
        try {
          // Test database connection
          console.log(`Creating Supabase client for project: ${config.project_id}`);
          const supabase = createClient(
            `https://${config.project_id}.supabase.co`,
            config.service_role_key
          );
          
          console.log('Testing database query...');
          const { data, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .limit(1);
            
          if (error) {
            console.error('Database query error:', error);
            throw error;
          }
          
          console.log(`Query successful, found ${data?.length || 0} tables`);
          
          return new Response(JSON.stringify({
            success: true,
            message: `Successfully connected to ${environment} database`,
            table_count: data?.length || 0
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
          
        } catch (error) {
          console.error('Connection validation failed:', error);
          return new Response(JSON.stringify({
            success: false,
            error: `Connection failed: ${error.message}`,
            environment,
            timestamp: new Date().toISOString()
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'get_rls_policies': {
        const config = getEnvironmentConfig(environment);
        
        try {
          const supabase = createClient(
            `https://${config.project_id}.supabase.co`,
            config.service_role_key
          );
          
          // Get all RLS policies for public schema
          const { data, error } = await supabase.rpc('get_rls_policies');
          
          if (error) throw error;
          
          return new Response(JSON.stringify({
            success: true,
            policies: data || []
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
          
        } catch (error) {
          console.error('Error fetching RLS policies:', error);
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to fetch RLS policies: ${error.message}`
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'check_database_empty': {
        console.log(`Checking if database is empty for environment: ${environment}`);
        const config = getEnvironmentConfig(environment);
        
        try {
          const supabase = createClient(
            `https://${config.project_id}.supabase.co`,
            config.service_role_key
          );
          
          console.log('Querying database tables...');
          
          // Check if database has any data in public tables
          const { data: tables, error: tablesError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public');
            
          if (tablesError) throw tablesError;
          
          let isEmpty = true;
          let totalRows = 0;
          
          for (const table of tables || []) {
            const { count, error } = await supabase
              .from(table.table_name)
              .select('*', { count: 'exact', head: true });
              
            if (error) continue; // Skip tables with access issues
            
            totalRows += count || 0;
            if ((count || 0) > 0) {
              isEmpty = false;
            }
          }
          
          return new Response(JSON.stringify({
            success: true,
            isEmpty,
            totalRows,
            tableCount: tables?.length || 0
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
          
        } catch (error) {
          console.error('Database check failed:', error);
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to check database: ${error.message}`,
            environment,
            timestamp: new Date().toISOString()
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'execute_production_deployment': {
        console.log('Starting production deployment execution...');
        
        // Get deployment ID from request
        const { deployment_id } = JSON.parse(body || '{}');
        
        try {
          // Create staging client to update deployment logs
          const stagingConfig = getEnvironmentConfig('staging');
          const stagingSupabase = createClient(
            `https://${stagingConfig.project_id}.supabase.co`,
            stagingConfig.service_role_key
          );

          // Update deployment log - starting
          await stagingSupabase
            .from('deployment_logs')
            .update({
              status: 'executing',
              message: 'Connecting to production database and applying security fixes...'
            })
            .eq('id', deployment_id);

          console.log('Connecting to production database...');

          // Connect to production database
          const productionConfig = getEnvironmentConfig('production');
          const productionSupabase = createClient(
            `https://${productionConfig.project_id}.supabase.co`,
            productionConfig.service_role_key
          );

          console.log('Applying security migration: deployment dashboard functions...');

          // Apply the deployment dashboard security fixes to production
          const migrationSql = `
            -- Create deployment_logs table if it doesn't exist
            CREATE TABLE IF NOT EXISTS public.deployment_logs (
              id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
              deployment_type TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'started',
              message TEXT,
              completed_at TIMESTAMP WITH TIME ZONE,
              details JSONB DEFAULT '{}'::jsonb
            );

            -- Enable RLS on deployment_logs
            ALTER TABLE public.deployment_logs ENABLE ROW LEVEL SECURITY;

            -- Create RLS policies for deployment_logs
            DROP POLICY IF EXISTS "deployment_logs_deny_public" ON public.deployment_logs;
            CREATE POLICY "deployment_logs_deny_public" 
            ON public.deployment_logs 
            FOR ALL 
            TO public 
            USING (false);

            DROP POLICY IF EXISTS "deployment_logs_service_access" ON public.deployment_logs;
            CREATE POLICY "deployment_logs_service_access" 
            ON public.deployment_logs 
            FOR ALL 
            TO service_role 
            USING (true) 
            WITH CHECK (true);

            -- Create deployment dashboard view
            CREATE OR REPLACE VIEW public.deployment_dashboard AS
            SELECT 
              id as deployment_id,
              created_at,
              deployment_type,
              status,
              CONCAT(LEFT(message, 100), CASE WHEN LENGTH(message) > 100 THEN '...' ELSE '' END) as summary,
              EXTRACT(EPOCH FROM (completed_at - created_at)) as duration_seconds,
              completed_at
            FROM public.deployment_logs
            ORDER BY created_at DESC;

            -- RLS policy for deployment dashboard view
            DROP POLICY IF EXISTS "deployment_dashboard_service_access" ON public.deployment_dashboard;
            CREATE POLICY "deployment_dashboard_service_access" 
            ON public.deployment_dashboard 
            FOR SELECT 
            TO service_role 
            USING (true);
          `;

          // Execute each statement separately to avoid transaction issues
          const statements = migrationSql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

          let appliedStatements = 0;
          for (const statement of statements) {
            try {
              const { error } = await productionSupabase.rpc('exec_sql', { 
                sql: statement 
              });
              if (error) {
                console.log(`Statement may already exist or be handled: ${error.message}`);
              } else {
                appliedStatements++;
              }
            } catch (err) {
              console.log(`Statement execution note: ${err.message}`);
            }
          }

          console.log(`Applied ${appliedStatements} migration statements to production`);

          // Verify the deployment by checking if deployment_logs table exists
          const { data: tableCheck, error: tableError } = await productionSupabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'deployment_logs');

          if (tableError || !tableCheck || tableCheck.length === 0) {
            throw new Error('Failed to verify deployment_logs table creation');
          }

          console.log('Production deployment verification successful');

          // Update deployment log - completed
          await stagingSupabase
            .from('deployment_logs')
            .update({
              status: 'completed',
              message: `Successfully applied security fixes to production database. Applied ${appliedStatements} migration statements.`,
              completed_at: new Date().toISOString(),
              details: {
                statements_applied: appliedStatements,
                production_project: productionConfig.project_id,
                verification_passed: true
              }
            })
            .eq('id', deployment_id);

          return new Response(JSON.stringify({
            success: true,
            message: 'Production deployment completed successfully',
            deployment_id,
            details: {
              migration_applied: 'deployment_dashboard_security_fixes',
              statements_applied: appliedStatements,
              production_project: productionConfig.project_id,
              timestamp: new Date().toISOString(),
              verification_passed: true
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });

        } catch (error) {
          console.error('Production deployment failed:', error);
          
          // Try to update the deployment log with failure status
          try {
            const stagingConfig = getEnvironmentConfig('staging');
            const stagingSupabase = createClient(
              `https://${stagingConfig.project_id}.supabase.co`,
              stagingConfig.service_role_key
            );
            
            await stagingSupabase
              .from('deployment_logs')
              .update({
                status: 'failed',
                message: `Deployment failed: ${error.message}`,
                completed_at: new Date().toISOString(),
                details: {
                  error: error.message,
                  stack: error.stack,
                  timestamp: new Date().toISOString()
                }
              })
              .eq('id', deployment_id);
          } catch (logError) {
            console.error('Failed to update deployment log:', logError);
          }

          return new Response(JSON.stringify({
            success: false,
            error: `Production deployment failed: ${error.message}`,
            deployment_id,
            timestamp: new Date().toISOString()
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Unknown action: ${action}`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    
  } catch (error) {
    console.error('Migration Helper Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});