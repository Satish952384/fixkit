import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Supabase client for Client Components (browser only).
 *
 * Uses only the public URL and publishable key, which are safe to expose.
 * Never put a service-role/secret key in this file.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart the dev server.",
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}