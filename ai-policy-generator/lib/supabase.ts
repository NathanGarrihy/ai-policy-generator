import { createClient } from "@supabase/supabase-js";

/**
 * Initialize a Supabase client for use throughout the application.
 *
 * The public keys are pulled from environment variables. These variables
 * should be exposed via Next.js runtime configuration and never hard coded.
 *
 * See https://supabase.com/docs/reference/javascript/initializing for details.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
