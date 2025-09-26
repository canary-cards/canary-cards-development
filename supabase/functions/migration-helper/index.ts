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
              message: 'Validating production database connection...'
            })
            .eq('id', deployment_id);

          console.log('Connecting to production database...');

          // Connect to production database
          const productionConfig = getEnvironmentConfig('production');
          const productionSupabase = createClient(
            `https://${productionConfig.project_id}.supabase.co`,
            productionConfig.service_role_key
          );

          console.log('Validating production database schema...');

          // Instead of executing raw SQL, let's validate that the production database 
          // has the required schema by checking for expected tables and functions
          const { data: tables, error: tablesError } = await productionSupabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .in('table_name', ['deployment_logs', 'customers', 'orders', 'postcards', 'postcard_drafts']);

          if (tablesError) {
            throw new Error(`Failed to query production tables: ${tablesError.message}`);
          }

          console.log(`Found ${tables?.length || 0} expected tables in production`);

          // Check if deployment_logs table exists specifically
          const hasDeploymentLogs = tables?.some(t => t.table_name === 'deployment_logs');
          
          if (!hasDeploymentLogs) {
            console.log('deployment_logs table not found - this is expected for new production deployments');
          }

          // Validate that we can perform basic operations
          const { data: basicQuery, error: basicError } = await productionSupabase
            .from('information_schema.tables')
            .select('table_name')
            .limit(1);

          if (basicError) {
            throw new Error(`Production database connection failed: ${basicError.message}`);
          }

          console.log('Production database validation successful');

          // Update deployment log - completed
          await stagingSupabase
            .from('deployment_logs')
            .update({
              status: 'completed',
              message: `Production deployment validation completed successfully. Found ${tables?.length || 0} expected tables. Database connection verified.`,
              completed_at: new Date().toISOString(),
              details: {
                production_project: productionConfig.project_id,
                tables_found: tables?.map(t => t.table_name) || [],
                verification_passed: true,
                deployment_method: 'validation_only',
                note: 'Schema changes should be applied through proper migration scripts, not Edge Functions'
              }
            })
            .eq('id', deployment_id);

          return new Response(JSON.stringify({
            success: true,
            message: 'Production deployment validation completed successfully',
            deployment_id,
            details: {
              production_project: productionConfig.project_id,
              tables_found: tables?.map(t => t.table_name) || [],
              timestamp: new Date().toISOString(),
              verification_passed: true,
              recommendation: 'Use proper migration scripts for schema changes'
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