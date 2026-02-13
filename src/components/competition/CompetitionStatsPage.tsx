"use client";

import { useEffect, useMemo, useState } from "react";
import { LeagueId } from "@/lib/api/leagues";
import { ScorerEntry, ScrapedCompetitionStatsResponse } from "@/lib/api/types";
import {
  getCompetitionTeams,
  getLikelyCurrentSeasonStartYear,
  getScrapedCompetitionStats,
  getTopScorers,
} from "@/lib/api/football";
import { Skeleton } from "@/components/ui/skeleton";
import ScorersTable from "@/components/competition/ScorersTable";
import { cn } from "@/lib/utils";
import ValueStatsTable from "@/components/competition/ValueStatsTable";

type StatsFilter =
  | "all"
  | "top-scorers"
  | "assists"
  | "red-cards"
  | "yellow-cards"
  | "shots-on-target";

const filters: Array<{ id: StatsFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "top-scorers", label: "Top Scorers" },
  { id: "assists", label: "Assists" },
  { id: "red-cards", label: "Red Cards" },
  { id: "yellow-cards", label: "Yellow Cards" },
  { id: "shots-on-target", label: "Shots on Targets" },
];

interface CompetitionStatsPageProps {
  leagueId: LeagueId;
}

export default function CompetitionStatsPage({ leagueId }: CompetitionStatsPageProps) {
  const seasonStart = getLikelyCurrentSeasonStartYear();
  const [activeFilter, setActiveFilter] = useState<StatsFilter>("all");
  const [scorers, setScorers] = useState<ScorerEntry[]>([]);
  const [competitionTeams, setCompetitionTeams] = useState<
    Array<{ id: number; name: string; shortName: string }>
  >([]);
  const [scrapedStats, setScrapedStats] =
    useState<ScrapedCompetitionStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadStats() {
      try {
        if (isActive) {
          setIsLoading(true);
          setError(null);
        }

        const [scorersResult, scrapedResult, teamsResult] = await Promise.allSettled([
          getTopScorers(leagueId, 40, seasonStart),
          getScrapedCompetitionStats(leagueId),
          getCompetitionTeams(leagueId),
        ]);

        if (!isActive) return;

        if (scorersResult.status === "fulfilled") {
          setScorers(scorersResult.value.scorers || []);
        } else {
          setScorers([]);
        }

        if (scrapedResult.status === "fulfilled") {
          setScrapedStats(scrapedResult.value);
        } else {
          setScrapedStats(null);
        }
        if (teamsResult.status === "fulfilled") {
          setCompetitionTeams(
            (teamsResult.value.teams || []).map((team) => ({
              id: team.id,
              name: team.name,
              shortName: team.shortName || team.name,
            }))
          );
        } else {
          setCompetitionTeams([]);
        }

        if (
          scorersResult.status === "rejected" &&
          scrapedResult.status === "rejected" &&
          teamsResult.status === "rejected"
        ) {
          setError("Failed to load all stat sources for this competition.");
        } else if (scrapedResult.status === "rejected") {
          setError(
            "Top scorers loaded, but card/shots stats scraping is temporarily unavailable."
          );
        }
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load stats.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadStats();
    return () => {
      isActive = false;
    };
  }, [leagueId, seasonStart]);

  const topScorers = useMemo(
    () => [...scorers].sort((a, b) => b.goals - a.goals).slice(0, 20),
    [scorers]
  );
  const topAssists = useMemo(
    () =>
      [...scorers]
        .filter((entry) => (entry.assists ?? 0) > 0)
        .sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0))
        .slice(0, 20),
    [scorers]
  );
  const yellowCards = scrapedStats?.yellowCards || [];
  const redCards = scrapedStats?.redCards || [];
  const shotsOnTarget = scrapedStats?.shotsOnTarget || [];
  const fetchedAtLabel = scrapedStats?.fetchedAt
    ? new Date(scrapedStats.fetchedAt).toLocaleString()
    : null;
  const normalizeTeamName = (value: string) =>
    value
      .toLowerCase()
      .replace(/\b(fc|cf|sc|afc|ac)\b/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const resolveTeamHref = (teamName: string) => {
    const normalizedTarget = normalizeTeamName(teamName);
    const exact =
      competitionTeams.find(
        (team) => normalizeTeamName(team.name) === normalizedTarget
      ) ||
      competitionTeams.find(
        (team) => normalizeTeamName(team.shortName) === normalizedTarget
      );
    const partial =
      exact ||
      competitionTeams.find((team) => {
        const full = normalizeTeamName(team.name);
        const short = normalizeTeamName(team.shortName);
        return (
          full.includes(normalizedTarget) ||
          normalizedTarget.includes(full) ||
          short.includes(normalizedTarget) ||
          normalizedTarget.includes(short)
        );
      });
    if (!partial) return null;
    return `/team/${partial.id}?league=${leagueId}`;
  };
  const resolveEntryHref = (
    entry: { player: string; team: string; entityId?: number | null },
    field: "subject" | "team"
  ) => {
    const directId = field === "subject" ? entry.entityId : null;
    if (directId && Number.isFinite(directId)) {
      return `/team/${directId}?league=${leagueId}`;
    }
    return resolveTeamHref(field === "subject" ? entry.player : entry.team);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 bg-zinc-800" />
        <Skeleton className="h-24 bg-zinc-800" />
        <Skeleton className="h-24 bg-zinc-800" />
      </div>
    );
  }

  if (error && !scorers.length && !scrapedStats) {
    return (
      <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActiveFilter(filter.id)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
              activeFilter === filter.id
                ? "bg-zinc-100 text-zinc-950"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {error ? (
        <div className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {error}
        </div>
      ) : null}
      {scrapedStats ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300">
            Source: {scrapedStats.source}
          </span>
          <span
            className={cn(
              "rounded-full border px-2 py-1",
              scrapedStats._meta?.stale
                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            )}
          >
            {scrapedStats._meta?.stale ? "Stale cache" : "Fresh"}
          </span>
          {fetchedAtLabel ? (
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-400">
              Fetched: {fetchedAtLabel}
            </span>
          ) : null}
          {scrapedStats._meta?.message ? (
            <span className="text-amber-300">{scrapedStats._meta.message}</span>
          ) : null}
        </div>
      ) : null}

      {(activeFilter === "all" || activeFilter === "top-scorers") && (
        <ScorersTable
          entries={topScorers}
          leagueId={leagueId}
          metric="goals"
          title="Top Scorers"
        />
      )}
      {(activeFilter === "all" || activeFilter === "assists") && (
        <ScorersTable
          entries={topAssists}
          leagueId={leagueId}
          metric="assists"
          title="Assists"
        />
      )}
      {(activeFilter === "all" || activeFilter === "red-cards") && (
        <ValueStatsTable
          entries={redCards}
          leagueId={leagueId}
          title="Red Cards"
          subjectLabel="Team"
          showTeamColumn={false}
          resolveEntryHref={resolveEntryHref}
        />
      )}
      {(activeFilter === "all" || activeFilter === "yellow-cards") && (
        <ValueStatsTable
          entries={yellowCards}
          leagueId={leagueId}
          title="Yellow Cards"
          subjectLabel="Team"
          showTeamColumn={false}
          resolveEntryHref={resolveEntryHref}
        />
      )}
      {(activeFilter === "all" || activeFilter === "shots-on-target") && (
        <ValueStatsTable
          entries={shotsOnTarget}
          leagueId={leagueId}
          title="Shots on Targets"
          subjectLabel="Team"
          showTeamColumn={false}
          resolveEntryHref={resolveEntryHref}
        />
      )}
    </div>
  );
}
