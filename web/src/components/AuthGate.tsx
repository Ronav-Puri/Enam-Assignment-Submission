"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "signedOut" | "signedIn">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setStatus(data.session ? "signedIn" : "signedOut"));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setStatus(session ? "signedIn" : "signedOut"),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  async function enterDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo-login", { method: "POST" });
      if (!res.ok) throw new Error("Demo sign-in failed");
      const tokens = await res.json();
      const { error } = await supabase.auth.setSession(tokens);
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return <div className="min-h-dvh" />;
  if (status === "signedIn") return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <div className="text-5xl font-semibold tracking-tight">FINN</div>
      <p className="mt-3 max-w-xs text-neutral-400">
        What changed in your portfolio, why it matters, and who you know who can explain it.
      </p>
      <button
        onClick={enterDemo}
        disabled={busy}
        className="mt-10 w-full max-w-xs rounded-full bg-white py-3 font-medium text-neutral-950 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Enter demo as Arjun Mehta"}
      </button>
      <p className="mt-3 text-xs text-neutral-500">Demo investor · synthetic network · real NSE data</p>
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </div>
  );
}