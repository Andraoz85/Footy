"use client";

import { useEffect, useState } from "react";
import { LeagueId } from "@/lib/api/leagues";
import { Match } from "@/lib/api/types";
import { getCompetitionMatches } from "@/lib/api/football";
import CompetitionMatchList from "@/components/competition/CompetitionMatchList";
import { Skeleton } from "@/components/ui/skeleton";

interface CompetitionMatchesPageProps {
  leagueId: LeagueId;
  mode: "fixtures" | "results";
}

export default function CompetitionMatchesPage({
  leagueId,
  mode,
}: CompetitionMatchesPageProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadMatches() {
      try {
        if (isActive) {
          setIsLoading(true);
          setError(null);
        }

        const todayDate = new Date();
        const dateFrom = todayDate.toISOString().split("T")[0];
        const nextDate = new Date(todayDate);
        nextDate.setDate(nextDate.getDate() + 30);
        const dateTo = nextDate.toISOString().split("T")[0];

        const response = await getCompetitionMatches(leagueId, {
          status: mode === "fixtures" ? "SCHEDULED" : "FINISHED",
          dateFrom: mode === "fixtures" ? dateFrom : undefined,
          dateTo: mode === "fixtures" ? dateTo : undefined,
          limit: mode === "results" ? 40 : undefined,
        });

        if (!isActive) return;

        const sorted = [...(response.matches || [])].sort((a, b) =>
          mode === "fixtures"
            ? new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
            : new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
        );
        setMatches(sorted);
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : `Failed to load ${mode}.`);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadMatches();
    return () => {
      isActive = false;
    };
  }, [leagueId, mode]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 bg-zinc-800" />
        <Skeleton className="h-20 bg-zinc-800" />
        <Skeleton className="h-20 bg-zinc-800" />
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

  return (
    <section>
      <h2 className="mb-2 text-base font-semibold capitalize text-zinc-100">{mode}</h2>
      <CompetitionMatchList matches={matches} leagueId={leagueId} mode={mode} />
    </section>
  );
}
