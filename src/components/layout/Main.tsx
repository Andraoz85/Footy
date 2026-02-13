"use client";
import { useEffect, useMemo, useState } from "react";
import { Match } from "@/lib/api/types";
import { DAYS_TO_FETCH, getUpcomingMatches } from "@/lib/api/football";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import FixturesList from "@/components/FixturesList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface LeagueMatches {
  leagueId: LeagueId;
  leagueName: string;
  matches: Match[];
}

export default function Main() {
  const [leagueMatches, setLeagueMatches] = useState<LeagueMatches[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function fetchMatches() {
      try {
        if (isActive) {
          setIsLoading(true);
          setError(null);
        }

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

        if (!isActive) return;

        if (matchesByLeague.length === 0) {
          setLeagueMatches([]);
          setError("No upcoming matches found");
        } else {
          setLeagueMatches(matchesByLeague);
          setError(null);
        }
      } catch (err) {
        if (!isActive) return;
        console.error("Error fetching matches:", err);
        setLeagueMatches([]);
        setError(err instanceof Error ? err.message : "Failed to load matches");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchMatches();

    return () => {
      isActive = false;
    };
  }, [reloadKey]);

  const sortedMatches = useMemo(
    () =>
      [...leagueMatches].sort((a, b) =>
        a.leagueName.localeCompare(b.leagueName)
      ),
    [leagueMatches]
  );

  const showEmptyState =
    error !== null ||
    (sortedMatches.length === 0 && !isLoading);

  // Determine the message to show when no data is available
  const getEmptyStateMessage = () => {
    if (error) {
      return error;
    } else {
      return "No upcoming matches found for any league.";
    }
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-[#0b111b]">
      <div className="flex h-full flex-col px-3 py-3 sm:px-4 sm:py-4">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100 sm:text-xl">
          Next Fixtures
        </h2>
        <div className="flex-1 rounded-lg p-2 sm:p-3 lg:max-h-[calc(100dvh-250px)] lg:overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 sm:space-y-4">
              <Skeleton className="h-16 bg-zinc-800 sm:h-20" />
              <Skeleton className="h-16 bg-zinc-800 sm:h-20" />
              <Skeleton className="h-16 bg-zinc-800 sm:h-20" />
            </div>
          ) : null}
          {!isLoading &&
            (showEmptyState ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-200">
                <p className="mb-2 font-semibold text-red-300">
                  Data Unavailable
                </p>
                <p className="mb-3">{getEmptyStateMessage()}</p>
                <div className="mb-3 text-sm text-zinc-400">
                  This might be due to:
                  <ul className="list-disc ml-5 mt-1">
                    <li>API rate limits reached</li>
                    <li>
                      No scheduled matches in the next {DAYS_TO_FETCH} days
                    </li>
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
              <div className="space-y-6">
                {sortedMatches.map((league) => (
                  <div key={league.leagueId}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-100 sm:text-base">
                        {league.leagueName}
                      </h3>
                      <Link
                        href={`/competition/${league.leagueId}`}
                        className="text-xs text-zinc-400 hover:text-zinc-100 sm:text-sm"
                      >
                        Open
                      </Link>
                    </div>
                    <FixturesList
                      matches={league.matches}
                      isLoading={isLoading}
                      leagueId={league.leagueId}
                    />
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
