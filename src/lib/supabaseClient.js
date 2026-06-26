import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly at startup rather than letting every downstream call
  // silently fail with a confusing network error - matches the
  // backend's approach of validating required config up front.
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in frontend/.env before running.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
