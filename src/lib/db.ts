import { createClient } from '@supabase/supabase-js';

import { config } from '../config.js';

let supabaseClient: ReturnType<typeof createClient> | null = null;

if (config.supabaseUrl && config.supabaseKey) {
  supabaseClient = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
}

export function getSupabaseClient() {
  return supabaseClient;
}

export function isSupabaseConfigured() {
  return Boolean(supabaseClient);
}
