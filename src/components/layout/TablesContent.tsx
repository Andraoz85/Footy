"use client";

import { useEffect, useState } from "react";
import { TableGroup } from "@/lib/api/types";
import { getLeagueStandings } from "@/lib/api/football";
import { LEAGUES } from "@/lib/api/leagues";
import LeagueTable from "@/components/LeagueTable";
import { useLeague } from "@/lib/context/LeagueContext";

export default function TablesContent() {
  const [standings, setStandings] = useState<TableGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedLeague } = useLeague();

  // Show Premier League by default if no league is selected
  const leagueToShow = selectedLeague || "PL";

  useEffect(() => {
    async function fetchStandings() {
      try {
        setIsLoading(true);
        setError(null);

        // Get the standings data for the selected league
        const data = await getLeagueStandings(leagueToShow);

        // Check if we got valid data
        if (data && data.standings) {
          if (data.standings.length === 0) {
            setStandings([]);
            setError(
              `No table data available for ${LEAGUES[leagueToShow].name}.`
            );
          } else {
            setStandings(data.standings);
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
        console.error("Error fetching standings:", err);
        setStandings([]);
        setError("Could not load table data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchStandings();
  }, [leagueToShow]); // Refetch when selected league changes

  return (
    <main className="flex-1 bg-green-800 shadow rounded-lg flex flex-col">
      <div className="px-2 py-3 sm:px-4 sm:py-5 flex flex-col h-full">
        <h2 className="text-lg sm:text-xl font-semibold text-white mb-2 sm:mb-4">
          {selectedLeague ? LEAGUES[selectedLeague].name : "All Tables"}
        </h2>
        <div className="flex-1 border-2 border-gray-200 rounded-lg p-2 sm:p-4 bg-white/5 min-h-[600px] max-h-[600px] overflow-y-auto">
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
            </div>
          ) : (
            <LeagueTable standings={standings || []} isLoading={isLoading} />
          )}
        </div>
      </div>
    </main>
  );
}
