"use client";

import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Overview", href: "" },
  { label: "Fixtures", href: "/fixtures" },
  { label: "Results", href: "/results" },
  { label: "Standings", href: "/standings" },
  { label: "Stats", href: "/stats" },
] as const;

interface CompetitionNavProps {
  leagueId: LeagueId;
}

export default function CompetitionNav({ leagueId }: CompetitionNavProps) {
  const pathname = usePathname();
  const league = LEAGUES[leagueId];
  const basePath = `/competition/${leagueId}`;

  return (
    <div className="mb-4 space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-[#171d2f] via-[#151824] to-[#11141d] p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 rounded-md bg-zinc-900/60 p-1">
            <Image
              src={league.emblem}
              alt={league.name}
              fill
              sizes="48px"
              className="object-contain p-1"
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-50">{league.name}</h1>
            <p className="text-sm text-zinc-400">Competition Overview</p>
          </div>
        </div>
      </div>

      <nav className="border-b border-zinc-800">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const href = `${basePath}${tab.href}`;
            const isActive = pathname === href;
            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-zinc-100 text-zinc-100"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
