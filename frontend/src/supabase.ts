import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Vercel/Vite embeds VITE_ values at build time. Supabase's browser client
 * expects the project origin, not the Data API path (/rest/v1) or Auth path
 * (/auth/v1). Normalize a accidentally pasted Data API URL safely.
 */
function getProjectOrigin(configuredUrl: string | undefined): string | null {
  if (!configuredUrl?.trim()) return null;

  try {
    const parsed = new URL(configuredUrl.trim());
    if (parsed.protocol !== 'https:' &&
        !(parsed.protocol === 'http:' &&
          (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

const url = getProjectOrigin(import.meta.env.VITE_SUPABASE_URL);
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const authConfigured = Boolean(url && key);

/**
 * The publishable/anon key is safe in client code with correctly configured RLS.
 * NEVER use the service_role or secret key in a VITE_ environment variable.
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
