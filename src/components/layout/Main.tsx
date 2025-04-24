"use client";
import { useEffect, useState } from "react";
import { Match } from "@/lib/api/types";
import { getUpcomingMatches } from "@/lib/api/football";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import FixturesList from "@/components/FixturesList";
import { useLeague } from "@/lib/context/LeagueContext";

interface LeagueMatches {
  leagueId: LeagueId;
  leagueName: string;
  matches: Match[];
}

export default function Main() {
  const [leagueMatches, setLeagueMatches] = useState<LeagueMatches[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedLeague } = useLeague();

  useEffect(() => {
    async function fetchMatches() {
      try {
        setIsLoading(true);
        const data = await getUpcomingMatches();

        const matchesByLeague: LeagueMatches[] = [];

        Object.entries(data).forEach(([leagueId, response]) => {
          if (response && response.matches.length > 0) {
            matchesByLeague.push({
              leagueId: leagueId as LeagueId,
              leagueName: LEAGUES[leagueId as LeagueId].name,
              matches: response.matches,
            });
          }
        });

        if (matchesByLeague.length === 0) {
          setError("No upcoming matches found");
        } else {
          setLeagueMatches(matchesByLeague);
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

  // Filter matches based on selected league
  const filteredMatches = selectedLeague
    ? leagueMatches.filter((league) => league.leagueId === selectedLeague)
    : leagueMatches;

  const showEmptyState =
    error !== null ||
    (selectedLeague && filteredMatches.length === 0 && !isLoading) ||
    (filteredMatches.length === 0 && !isLoading);

  // Determine the message to show when no data is available
  const getEmptyStateMessage = () => {
    if (error) {
      return error;
    } else if (selectedLeague) {
      return `No upcoming matches found for ${LEAGUES[selectedLeague].name}.`;
    } else {
      return "No upcoming matches found for any league.";
    }
  };

  return (
    <main className="flex-1 bg-green-800 shadow rounded-lg flex flex-col">
      <div className="px-2 py-3 sm:px-4 sm:py-5 flex flex-col h-full">
        <h2 className="text-lg sm:text-xl font-semibold text-white mb-2 sm:mb-4">
          {selectedLeague ? LEAGUES[selectedLeague].name : "All Fixtures"}
        </h2>
        <div
          className="flex-1 rounded-lg p-2 sm:p-4 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 250px)" }}
        >
          {showEmptyState ? (
            <div className="bg-white/80 p-4 rounded-lg text-gray-800">
              <p className="text-red-600 font-semibold mb-2">
                Data Unavailable
              </p>
              <p className="mb-3">{getEmptyStateMessage()}</p>
              <div className="text-sm text-gray-600 mb-3">
                This might be due to:
                <ul className="list-disc ml-5 mt-1">
                  <li>API rate limits reached</li>
                  <li>No scheduled matches in the next 30 days</li>
                  <li>Temporary server issues</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredMatches.map((league) => (
                <div key={league.leagueId}>
                  {!selectedLeague && (
                    <h3 className="text-white text-sm sm:text-base font-medium mb-2">
                      {league.leagueName}
                    </h3>
                  )}
                  <FixturesList
                    matches={league.matches}
                    isLoading={isLoading}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
