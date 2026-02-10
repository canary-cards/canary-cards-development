import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const VERSION = '1.0.0';

interface HealthCheck {
  status: 'ok' | 'degraded' | 'error';
  responseTime?: number;
  error?: string;
  details?: any;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'error';
  version: string;
  timestamp: string;
  checks: {
    database: HealthCheck;
    environment: HealthCheck;
  };
  summary?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle HEAD requests (used by UptimeRobot and other monitors)
  if (req.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const startTime = Date.now();
  
  try {
    const url = new URL(req.url);
    const deepCheck = url.searchParams.get('deep') === 'true';
    
    // Environment variables check
    const envCheck = checkEnvironment();
    
    // Database connectivity check
    const dbCheck = await checkDatabase(deepCheck);
    
    // Determine overall status
    const overallStatus = determineOverallStatus(envCheck, dbCheck);
    
    const response: HealthResponse = {
      status: overallStatus,
      version: VERSION,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
        environment: envCheck
      }
    };
    
    // Add summary for degraded or error states
    if (overallStatus !== 'healthy') {
      response.summary = generateSummary(envCheck, dbCheck);
    }
    
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 503 : 500;
    
    console.log(`Health check completed in ${Date.now() - startTime}ms - Status: ${overallStatus}`);
    
    return new Response(JSON.stringify(response, null, 2), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    
    const response: HealthResponse = {
      status: 'error',
      version: VERSION,
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'error', error: 'Check failed' },
        environment: { status: 'error', error: 'Check failed' }
      },
      summary: error.message || 'Unknown error occurred'
    };
    
    return new Response(JSON.stringify(response, null, 2), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function checkEnvironment(): HealthCheck {
  const startTime = Date.now();
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const missing: string[] = [];
  
  for (const varName of requiredVars) {
    if (!Deno.env.get(varName)) {
      missing.push(varName);
    }
  }
  
  const responseTime = Date.now() - startTime;
  
  if (missing.length > 0) {
    return {
      status: 'error',
      responseTime,
      error: `Missing environment variables: ${missing.join(', ')}`
    };
  }
  
  return {
    status: 'ok',
    responseTime,
    details: { variables_checked: requiredVars.length }
  };
}

async function checkDatabase(deepCheck: boolean): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: 'Missing Supabase credentials'
      };
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Basic connectivity check - lightweight head request
    const { count, error } = await supabase
      .from('postcards')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Database query error:', error);
      return {
        status: 'degraded',
        responseTime: Date.now() - startTime,
        error: `Database query failed: ${error.message}`
      };
    }
    
    const responseTime = Date.now() - startTime;
    const details: any = {
      postcards_count: count || 0,
      connection: 'established'
    };
    
    // Deep check: verify critical tables exist
    if (deepCheck) {
      const tables = ['customers', 'orders', 'postcard_drafts'];
      const tableChecks: string[] = [];
      
      for (const table of tables) {
        const { error: tableError } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (tableError) {
          tableChecks.push(`${table}: error`);
        } else {
          tableChecks.push(`${table}: ok`);
        }
      }
      
      details.table_checks = tableChecks;
    }
    
    // Warn if response time is slow
    if (responseTime > 1000) {
      return {
        status: 'degraded',
        responseTime,
        error: 'Slow database response',
        details
      };
    }
    
    return {
      status: 'ok',
      responseTime,
      details
    };
    
  } catch (error) {
    return {
      status: 'error',
      responseTime: Date.now() - startTime,
      error: error.message || 'Database connection failed'
    };
  }
}

function determineOverallStatus(
  envCheck: HealthCheck,
  dbCheck: HealthCheck
): 'healthy' | 'degraded' | 'error' {
  // If any check is in error state, overall is error
  if (envCheck.status === 'error' || dbCheck.status === 'error') {
    return 'error';
  }
  
  // If any check is degraded, overall is degraded
  if (envCheck.status === 'degraded' || dbCheck.status === 'degraded') {
    return 'degraded';
  }
  
  return 'healthy';
}

function generateSummary(envCheck: HealthCheck, dbCheck: HealthCheck): string {
  const issues: string[] = [];
  
  if (envCheck.status !== 'ok') {
    issues.push(`Environment: ${envCheck.error || 'degraded'}`);
  }
  
  if (dbCheck.status !== 'ok') {
    issues.push(`Database: ${dbCheck.error || 'degraded'}`);
  }
  
  return issues.length > 0 ? issues.join('; ') : 'Unknown issue';
}
