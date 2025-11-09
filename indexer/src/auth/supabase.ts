import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getEnv } from '../env';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const env = getEnv();
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(env.supabase.url, env.supabase.serviceRoleKey);
  }

  return cachedClient;
}
