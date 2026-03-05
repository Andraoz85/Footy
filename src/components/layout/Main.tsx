"use client";
import { useEffect, useMemo, useState } from "react";
import { Match } from "@/lib/api/types";
import { DAYS_TO_FETCH, getUpcomingMatches } from "@/lib/api/football";
import { LEAGUES, LeagueId } from "@/lib/api/leagues";
import FixturesList from "@/components/FixturesList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Main() {
  const [matches, setMatches] = useState<Match[]>([]);
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
        const allMatches = Object.entries(data)
          .flatMap(([leagueId, response]) => {
            if (!response?.matches?.length) return [];

            const fallbackCompetitionName =
              response.competition?.name ||
              LEAGUES[leagueId as LeagueId]?.name ||
              "Unknown competition";

            return response.matches.map((match) => ({
              ...match,
              competition:
                match.competition?.name
                  ? match.competition
                  : {
                      name: fallbackCompetitionName,
                      code: leagueId,
                    },
            }));
          })
          .sort(
            (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
          );

        if (!isActive) return;

        if (allMatches.length === 0) {
          setMatches([]);
          setError("No upcoming matches found");
        } else {
          setMatches(allMatches);
          setError(null);
        }
      } catch (err) {
        if (!isActive) return;
        console.error("Error fetching matches:", err);
        setMatches([]);
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

  const sortedMatches = useMemo(() => [...matches], [matches]);
  const groupedMatches = useMemo(() => {
    const dateKeyFormatter = new Intl.DateTimeFormat("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateLabelFormatter = new Intl.DateTimeFormat("sv-SE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const groups = new Map<
      string,
      { dateLabel: string; competition: string; matches: Match[] }
    >();

    for (const match of sortedMatches) {
      const kickoff = new Date(match.utcDate);
      const dateKey = dateKeyFormatter.format(kickoff);
      const competition = match.competition?.name || "Okänd turnering";
      const groupKey = `${dateKey}__${competition}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          dateLabel: dateLabelFormatter.format(kickoff),
          competition,
          matches: [],
        });
      }

      groups.get(groupKey)?.matches.push(match);
    }

    return Array.from(groups.values());
  }, [sortedMatches]);

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
          Upcoming Fixtures
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
              <div className="space-y-4">
                {groupedMatches.map((group) => (
                  <section
                    key={`${group.dateLabel}-${group.competition}`}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3"
                  >
                    <div className="mb-3 border-b border-zinc-800/70 pb-2">
                      <p className="text-xs uppercase tracking-wide text-zinc-400">
                        {group.dateLabel}
                      </p>
                      <h3 className="text-sm font-semibold text-zinc-100 sm:text-base">
                        {group.competition}
                      </h3>
                    </div>
                    <FixturesList
                      matches={group.matches}
                      isLoading={isLoading}
                    />
                  </section>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
