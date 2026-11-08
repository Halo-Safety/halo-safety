import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const authConfigured = Boolean(url && key);

/**
 * Publishable key (or legacy anon key) is safe for the browser.
 * NEVER use Supabase service_role or secret keys with a VITE_ prefix.
 */
export const supabase: SupabaseClient | null = authConfigured
  ? createClient(url!, key!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
