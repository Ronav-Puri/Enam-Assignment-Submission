import { createClient } from "@supabase/supabase-js";

// Signs in as the demo investor ON THE SERVER, so the demo password never reaches the browser.
// Returns only the session tokens.
export async function POST() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await sb.auth.signInWithPassword({
    email: process.env.DEMO_EMAIL!,
    password: process.env.DEMO_PASSWORD!,
  });
  if (error || !data.session) {
    return Response.json({ error: "Demo sign-in failed" }, { status: 500 });
  }
  return Response.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}