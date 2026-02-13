"use client";

import { useEffect, useState } from "react";
import { LeagueId } from "@/lib/api/leagues";
import { TableGroup } from "@/lib/api/types";
import { getLeagueStandings, getLikelyCurrentSeasonStartYear } from "@/lib/api/football";
import LeagueTable from "@/components/LeagueTable";
import { Skeleton } from "@/components/ui/skeleton";

interface CompetitionStandingsPageProps {
  leagueId: LeagueId;
}

export default function CompetitionStandingsPage({
  leagueId,
}: CompetitionStandingsPageProps) {
  const seasonStart = getLikelyCurrentSeasonStartYear();
  const [standings, setStandings] = useState<TableGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadStandings() {
      try {
        if (isActive) {
          setIsLoading(true);
          setError(null);
        }

        const data = await getLeagueStandings(leagueId, seasonStart);

        if (!isActive) return;

        const normalized =
          data.standings?.filter((group) => group.type === "TOTAL").length
            ? data.standings.filter((group) => group.type === "TOTAL")
            : data.standings || [];
        setStandings(normalized);
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load standings.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadStandings();
    return () => {
      isActive = false;
    };
  }, [leagueId, seasonStart]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 bg-zinc-800" />
        <Skeleton className="h-10 bg-zinc-800" />
        <Skeleton className="h-10 bg-zinc-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
        {error}
      </div>
    );
  }

  return <LeagueTable standings={standings} isLoading={false} leagueId={leagueId} />;
}
