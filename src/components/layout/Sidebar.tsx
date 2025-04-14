"use client";

import { LEAGUES, LeagueId } from "@/lib/api/leagues";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useLeague } from "@/lib/context/LeagueContext";

export default function Sidebar() {
  const { selectedLeague, setSelectedLeague } = useLeague();

  return (
    <aside className="w-full md:w-64 bg-white shadow rounded-lg p-4 mb-6 md:mb-0 min-h-[400px] max-h-[600px] overflow-y-auto">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Leagues</h2>
      <nav className="space-y-1">
        {Object.entries(LEAGUES).map(([id, league]) => (
          <button
            key={id}
            onClick={() =>
              setSelectedLeague(selectedLeague === id ? null : (id as LeagueId))
            }
            className={cn(
              "w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors",
              "hover:bg-gray-100",
              selectedLeague === id
                ? "bg-green-50 text-black font-bold border border-green-200"
                : "text-black"
            )}
          >
            <div className="w-6 h-6 mr-3 relative flex-shrink-0">
              <Image
                src={league.emblem}
                alt={league.name}
                fill
                className="object-contain"
              />
            </div>
            {league.name}
          </button>
        ))}
      </nav>
    </aside>
  );
}
