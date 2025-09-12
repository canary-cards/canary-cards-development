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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, environment } = await req.json();

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

    switch (action) {
      case 'get_credentials': {
        const config = getEnvironmentConfig(environment);
        
        // Build database URL with password from secrets
        const password = environment === 'production' 
          ? Deno.env.get('PRODUCTION_DB_PASSWORD')
          : Deno.env.get('STAGING_DB_PASSWORD');
        
        if (!password) {
          throw new Error(`Database password not configured for ${environment}`);
        }

        const dbUrl = `postgresql://postgres.${config.project_id}:${password}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`;
        
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
        const config = getEnvironmentConfig(environment);
        
        try {
          // Test database connection
          const supabase = createClient(
            `https://${config.project_id}.supabase.co`,
            config.service_role_key
          );
          
          const { data, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .limit(1);
            
          if (error) throw error;
          
          return new Response(JSON.stringify({
            success: true,
            message: `Successfully connected to ${environment} database`,
            table_count: data?.length || 0
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
          
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: `Connection failed: ${error.message}`
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
        const config = getEnvironmentConfig(environment);
        
        try {
          const supabase = createClient(
            `https://${config.project_id}.supabase.co`,
            config.service_role_key
          );
          
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
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to check database: ${error.message}`
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
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});