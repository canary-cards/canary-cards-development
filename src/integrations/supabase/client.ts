// Multi-environment Supabase client with runtime configuration
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/environment';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});