import { createClient } from "@supabase/supabase-js";

// In the browser, go through our own domain's /sb proxy instead of *.supabase.co directly.
const url =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_SUPABASE_URL!
    : `${window.location.origin}/sb`;

export const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { storageKey: "finn-auth" },
});