import { createClient } from "@supabase/supabase-js";

/** Server-only client with the SECRET key (bypasses RLS). Never import this from a client component. */
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}