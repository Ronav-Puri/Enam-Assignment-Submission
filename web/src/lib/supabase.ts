import { createClient } from "@supabase/supabase-js";

// Browser client. Uses the publishable key; Row Level Security limits it to the
// signed-in investor's own data.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);