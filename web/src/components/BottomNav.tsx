"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, Search, SlidersHorizontal, Users } from "lucide-react";

const TABS = [
  { href: "/", label: "Today", Icon: Newspaper },
  { href: "/research", label: "Research", Icon: Search },
  { href: "/people", label: "People", Icon: Users },
  { href: "/settings", label: "Alerts", Icon: SlidersHorizontal },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-neutral-950/85 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md justify-around">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${active ? "text-white" : "text-neutral-500"}`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}