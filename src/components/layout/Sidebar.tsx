"use client";

import { LEAGUES, LeagueId } from "@/lib/api/leagues";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useLeague } from "@/lib/context/LeagueContext";

export default function Sidebar() {
  const { selectedLeague, setSelectedLeague } = useLeague();

  return (
    <aside className="w-full md:w-52 lg:w-56 flex-shrink-0 bg-white shadow rounded-lg p-3 mb-6 md:mb-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Leagues</h2>
      <nav className="space-y-1">
        {Object.entries(LEAGUES).map(([id, league]) => (
          <button
            key={id}
            onClick={() =>
              setSelectedLeague(selectedLeague === id ? null : (id as LeagueId))
            }
            className={cn(
              "w-full flex items-center px-2 py-1.5 text-sm rounded-md transition-colors",
              "hover:bg-gray-100",
              selectedLeague === id
                ? "bg-green-50 text-black font-bold border border-green-200"
                : "text-black"
            )}
          >
            <div className="w-5 h-5 mr-2 relative flex-shrink-0">
              <Image
                src={league.emblem}
                alt={league.name}
                fill
                className="object-contain"
              />
            </div>
            <span className="truncate">{league.name}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
