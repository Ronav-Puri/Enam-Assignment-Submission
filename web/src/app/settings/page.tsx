"use client";

import { useEffect, useState } from "react";
import { loadPrefs, savePrefs } from "@/lib/data";
import type { Prefs } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui";

const CHOOSABLE = Object.keys(CATEGORY_LABEL).filter((c) => c !== "unclassified");

export default function SettingsPage() {
  const [p, setP] = useState<Prefs | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    loadPrefs().then(setP).catch(() => setStatus("error"));
  }, []);

  if (!p) return <Skeleton />;

  const toggle = (c: string) =>
    setP({
      ...p,
      alert_categories: p.alert_categories.includes(c)
        ? p.alert_categories.filter((x) => x !== c)
        : [...p.alert_categories, c],
    });

  async function save() {
    if (!p) return;
    setStatus("saving");
    try {
      await savePrefs(p);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Alert rules</h1>
      <p className="mt-2 text-sm text-neutral-400">
        FINN watches your portfolio and puts anything matching these rules at the top of Today.
      </p>

      <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-neutral-300">Daily price move beyond ±</span>
          <span className="flex items-center gap-1">
            <input
              type="number" min={0.5} step={0.5} value={p.price_move_pct}
              onChange={(e) => setP({ ...p, price_move_pct: Number(e.target.value) })}
              className="w-16 rounded-lg bg-white/10 px-2 py-1 text-right tabular-nums"
            />
            <span className="text-neutral-500">%</span>
          </span>
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-neutral-300">Volume above its 20-day average by</span>
          <span className="flex items-center gap-1">
            <input
              type="number" min={1} step={0.5} value={p.volume_multiple}
              onChange={(e) => setP({ ...p, volume_multiple: Number(e.target.value) })}
              className="w-16 rounded-lg bg-white/10 px-2 py-1 text-right tabular-nums"
            />
            <span className="text-neutral-500">×</span>
          </span>
        </label>
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">
        Filing types that alert me
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {CHOOSABLE.map((c) => {
          const on = p.alert_categories.includes(c);
          return (
            <button
              key={c}
              onClick={() => toggle(c)}
              className={`rounded-full px-3 py-1.5 text-sm ${on ? "bg-white text-neutral-950" : "bg-white/5 text-neutral-400"}`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          );
        })}
      </div>

      <button
        onClick={save}
        disabled={status === "saving"}
        className="mt-8 w-full rounded-full bg-white py-3 font-medium text-neutral-950 disabled:opacity-60"
      >
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save rules"}
      </button>
      {status === "error" && <p className="mt-2 text-sm text-rose-400">Couldn&apos;t save. Try again.</p>}

      <button onClick={() => supabase.auth.signOut()} className="mt-10 w-full text-sm text-neutral-500">
        Sign out
      </button>
    </div>
  );
}