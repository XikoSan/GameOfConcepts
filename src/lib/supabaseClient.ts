import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function getSupabaseClient() {
  console.log('[supabase config]', {
    hasUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
    hasKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vite environment.'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
