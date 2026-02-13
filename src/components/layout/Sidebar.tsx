"use client";

import { LEAGUES } from "@/lib/api/leagues";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const leagueIds = Object.keys(LEAGUES);
  const activeLeagueId =
    leagueIds.find((id) => pathname.startsWith(`/competition/${id}`)) || "";
  const mobileSelectValue = pathname === "/" ? "__all" : activeLeagueId;

  return (
    <aside className="w-full flex-shrink-0 rounded-xl border border-zinc-800 bg-[#0b111b] p-3 lg:mb-0 lg:w-56 xl:w-60">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Competitions
      </h2>
      <div className="mb-1 flex items-center gap-2 lg:hidden">
        <Link
          href="/"
          className={cn(
            "inline-flex shrink-0 items-center rounded-md px-2.5 py-2 text-sm transition-colors",
            pathname === "/"
              ? "bg-zinc-100 text-zinc-950"
              : "text-zinc-300 hover:bg-zinc-800"
          )}
        >
          All Fixtures
        </Link>
        <select
          value={mobileSelectValue}
          onChange={(event) => {
            const value = event.target.value;
            router.push(value === "__all" ? "/" : `/competition/${value}`);
          }}
          className="h-10 min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none transition-colors focus:border-zinc-500"
          aria-label="Select competition"
        >
          <option value="__all">Select competition</option>
          {Object.entries(LEAGUES).map(([id, league]) => (
            <option key={id} value={id}>
              {league.name}
            </option>
          ))}
        </select>
      </div>

      <nav className="hidden space-y-1.5 lg:block">
        <Link
          href="/"
          className={cn(
            "inline-flex shrink-0 items-center rounded-md px-2.5 py-2 text-sm transition-colors lg:flex lg:w-full",
            pathname === "/"
              ? "bg-zinc-100 text-zinc-950"
              : "text-zinc-300 hover:bg-zinc-800"
          )}
        >
          All Fixtures
        </Link>
        {Object.entries(LEAGUES).map(([id, league]) => (
          <Link
            key={id}
            href={`/competition/${id}`}
            className={cn(
              "inline-flex shrink-0 items-center rounded-md px-2.5 py-2 text-sm transition-colors lg:flex lg:w-full",
              pathname.startsWith(`/competition/${id}`)
                ? "bg-zinc-100 text-zinc-950"
                : "text-zinc-300 hover:bg-zinc-800"
            )}
          >
            <div className="relative mr-2 h-5 w-5 flex-shrink-0">
              <Image
                src={league.emblem}
                alt={league.name}
                fill
                className="object-contain"
              />
            </div>
            <span className="truncate">{league.name}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
