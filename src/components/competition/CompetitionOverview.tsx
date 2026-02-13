"use client";

import { useEffect, useState } from "react";
import { LeagueId } from "@/lib/api/leagues";
import { Match, ScorerEntry, TableGroup } from "@/lib/api/types";
import {
  getCompetitionMatches,
  getLeagueStandings,
  getLikelyCurrentSeasonStartYear,
  getTopScorers,
} from "@/lib/api/football";
import { Skeleton } from "@/components/ui/skeleton";
import CompetitionMatchList from "@/components/competition/CompetitionMatchList";
import LeagueTable from "@/components/LeagueTable";
import ScorersTable from "@/components/competition/ScorersTable";

interface CompetitionOverviewProps {
  leagueId: LeagueId;
}

export default function CompetitionOverview({ leagueId }: CompetitionOverviewProps) {
  const seasonStart = getLikelyCurrentSeasonStartYear();
  const [fixtures, setFixtures] = useState<Match[]>([]);
  const [results, setResults] = useState<Match[]>([]);
  const [standings, setStandings] = useState<TableGroup[]>([]);
  const [scorers, setScorers] = useState<ScorerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadOverview() {
      try {
        if (isActive) {
          setIsLoading(true);
          setError(null);
        }

        const todayDate = new Date();
        const dateFrom = todayDate.toISOString().split("T")[0];
        const upcomingDate = new Date(todayDate);
        upcomingDate.setDate(upcomingDate.getDate() + 14);
        const dateTo = upcomingDate.toISOString().split("T")[0];

        const [fixturesData, resultsData, standingsData, scorersData] =
          await Promise.all([
            getCompetitionMatches(leagueId, {
              status: "SCHEDULED",
              dateFrom,
              dateTo,
            }),
            getCompetitionMatches(leagueId, {
              status: "FINISHED",
              limit: 12,
            }),
            getLeagueStandings(leagueId, seasonStart),
            getTopScorers(leagueId, 10, seasonStart),
          ]);

        if (!isActive) return;

        const normalizedStandings =
          standingsData.standings?.filter((group) => group.type === "TOTAL").length
            ? standingsData.standings.filter((group) => group.type === "TOTAL")
            : standingsData.standings || [];

        setFixtures(
          [...(fixturesData.matches || [])].sort(
            (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
          )
        );
        setResults(
          [...(resultsData.matches || [])]
            .filter((match) => match.status === "FINISHED")
            .sort(
              (a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
            )
        );
        setStandings(normalizedStandings);
        setScorers(scorersData.scorers || []);
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load competition data.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadOverview();
    return () => {
      isActive = false;
    };
  }, [leagueId, seasonStart]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 bg-zinc-800" />
        <Skeleton className="h-28 bg-zinc-800" />
        <Skeleton className="h-28 bg-zinc-800" />
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
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-base font-semibold text-zinc-100">Standings</h2>
        <LeagueTable standings={standings} isLoading={false} leagueId={leagueId} />
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-zinc-100">Fixtures</h2>
        <CompetitionMatchList matches={fixtures.slice(0, 8)} leagueId={leagueId} mode="fixtures" />
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-zinc-100">Results</h2>
        <CompetitionMatchList matches={results.slice(0, 8)} leagueId={leagueId} mode="results" />
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-zinc-100">Stats</h2>
        <ScorersTable entries={scorers.slice(0, 10)} leagueId={leagueId} metric="goals" />
      </section>
    </div>
  );
}
