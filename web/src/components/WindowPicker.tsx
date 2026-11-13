"use client";

const OPTIONS = [
  { days: 1, label: "24h" },
  { days: 3, label: "3d" },
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
];

export function WindowPicker({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <div role="tablist" className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm">
      {OPTIONS.map((o) => (
        <button
          key={o.days}
          role="tab"
          aria-selected={days === o.days}
          onClick={() => onChange(o.days)}
          className={`rounded-full px-3.5 py-1.5 transition ${days === o.days ? "bg-white text-neutral-950" : "text-neutral-400"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}