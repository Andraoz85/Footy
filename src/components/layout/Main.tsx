"use client";
import { useEffect, useState } from "react";
import { Match } from "@/lib/api/types";
import { getUpcomingMatches } from "@/lib/api/football";
import FixturesList from "@/components/FixturesList";

export default function Main() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatches() {
      try {
        setIsLoading(true);
        const data = await getUpcomingMatches();
        if (data.matches.length === 0) {
          setError("No upcoming matches found");
        } else {
          setMatches(data.matches);
          setError(null);
        }
      } catch (err) {
        console.error("Error fetching matches:", err);
        setError(err instanceof Error ? err.message : "Failed to load matches");
      } finally {
        setIsLoading(false);
      }
    }

    fetchMatches();
  }, []);

  return (
    <main className="flex-1 bg-green-800 shadow rounded-lg flex flex-col">
      <div className="px-2 py-3 sm:px-4 sm:py-5 flex flex-col h-full">
        <h2 className="text-lg sm:text-xl font-semibold text-white mb-2 sm:mb-4">
          Fixtures
        </h2>
        <div className="flex-1 border-2 border-gray-200 rounded-lg p-2 sm:p-4 bg-white/5 min-h-[900px] max-h-[600px] overflow-y-auto">
          {error ? (
            <p className="text-red-500">Error: {error}</p>
          ) : (
            <FixturesList matches={matches} isLoading={isLoading} />
          )}
        </div>
      </div>
    </main>
  );
}
