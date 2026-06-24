import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let browserClient: ReturnType<typeof createClient<Database>> | null = null;

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase frontend environment variables.");
  }

  if (!browserClient) {
    browserClient = createClient<Database>(supabaseUrl, supabaseKey);
  }

  return browserClient;
}
