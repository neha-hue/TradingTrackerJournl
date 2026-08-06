import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env.local file.');
}

// Optional single-owner account the app signs into automatically on startup, so no
// login screen is shown - see ensureSignedIn() in AppContext.
// Set these in .env.local for local use only. They must NOT be set on the deployed
// site: Vite inlines env values into the JS bundle, so anyone with the URL could read
// them. Without them the app falls back to the normal login screen, and Supabase keeps
// the session in localStorage - so each device asks once and never again.
export const AUTO_LOGIN_EMAIL = import.meta.env.VITE_AUTO_LOGIN_EMAIL || '';
export const AUTO_LOGIN_PASSWORD = import.meta.env.VITE_AUTO_LOGIN_PASSWORD || '';
export const AUTO_LOGIN_ENABLED = !!(AUTO_LOGIN_EMAIL && AUTO_LOGIN_PASSWORD);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
