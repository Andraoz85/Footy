"use client";

import { useEffect, useState } from "react";
import { TableGroup } from "@/lib/api/types";
import {
  getLeagueStandings,
  getLikelyCurrentSeasonStartYear,
} from "@/lib/api/football";
import { LEAGUES } from "@/lib/api/leagues";
import LeagueTable from "@/components/LeagueTable";
import { useLeague } from "@/lib/context/LeagueContext";
import { Button } from "@/components/ui/button";

export default function TablesContent() {
  const seasonStartYear = getLikelyCurrentSeasonStartYear();
  const [standings, setStandings] = useState<TableGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { selectedLeague } = useLeague();

  // Show Premier League by default if no league is selected
  const leagueToShow = selectedLeague || "PL";

  useEffect(() => {
    let isActive = true;

    async function fetchStandings() {
      try {
        if (isActive) {
          setIsLoading(true);
          setError(null);
        }

        // Get the standings data for the selected league
        const data = await getLeagueStandings(leagueToShow, seasonStartYear);

        if (!isActive) return;

        // Check if we got valid data
        if (data && data.standings) {
          const normalizedStandings =
            data.standings.filter((group) => group.type === "TOTAL").length > 0
              ? data.standings.filter((group) => group.type === "TOTAL")
              : data.standings;

          if (normalizedStandings.length === 0) {
            setStandings([]);
            setError(
              `No table data available for ${LEAGUES[leagueToShow].name}.`
            );
          } else {
            setStandings(normalizedStandings);
          }
        } else {
          setStandings([]);
          // Check for specific error types
          if (data && data.errorCode === 429) {
            setError(`API rate limit reached. Please try again later.`);
          } else if (data && data.message) {
            setError(`API error: ${data.message}`);
          } else {
            setError(
              `Could not load table data for ${LEAGUES[leagueToShow].name}.`
            );
          }
        }
      } catch (err) {
        if (!isActive) return;
        console.error("Error fetching standings:", err);
        setStandings([]);
        setError("Could not load table data. Please try again later.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchStandings();
    return () => {
      isActive = false;
    };
  }, [leagueToShow, reloadKey, seasonStartYear]); // Refetch when selected league changes or manual retry

  return (
    <main className="flex-1 bg-green-800 shadow rounded-lg flex flex-col">
      <div className="px-2 py-3 sm:px-4 sm:py-5 flex flex-col h-full">
        <h2 className="text-lg sm:text-xl font-semibold text-white mb-2 sm:mb-4">
          {selectedLeague ? LEAGUES[selectedLeague].name : "Premier League"}
        </h2>
        <p className="text-xs sm:text-sm text-green-100 mb-3">
          Season {seasonStartYear}/{(seasonStartYear + 1).toString().slice(2)}
        </p>
        <div className="flex-1 rounded-lg p-2 sm:p-4 lg:max-h-[calc(100dvh-250px)] lg:overflow-y-auto">
          {error ? (
            <div className="bg-white/80 p-4 rounded-lg">
              <p className="text-red-600 font-semibold mb-2">
                Data Unavailable
              </p>
              <p className="mb-3">{error}</p>
              <div className="text-sm text-gray-600 mb-3">
                This might be due to:
                <ul className="list-disc ml-5 mt-1">
                  <li>API rate limits reached</li>
                  <li>League data not available</li>
                  <li>Temporary server issues</li>
                </ul>
              </div>
              <Button
                onClick={() => setReloadKey((value) => value + 1)}
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : (
            <LeagueTable
              standings={standings || []}
              isLoading={isLoading}
              leagueId={leagueToShow}
            />
          )}
        </div>
      </div>
    </main>
  );
}
