import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Supabase] Missing required environment variables.\n' +
    '  VITE_SUPABASE_URL:      ' + (supabaseUrl ? 'set' : 'MISSING') + '\n' +
    '  VITE_SUPABASE_ANON_KEY: ' + (supabaseAnonKey ? 'set' : 'MISSING') + '\n' +
    'Create a .env file in the project root — see .env.example for the template.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
