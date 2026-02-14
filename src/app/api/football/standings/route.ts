import { NextResponse } from "next/server";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import {
  buildCompetitionMeta,
  fetchEspnJson,
  fetchLeagueScoreboard,
  mapScoreboardEventToMatch,
} from "@/lib/server/espn";
import { Match, StandingsResponse, TablePosition } from "@/lib/api/types";
import { getFreshCache, getStaleCache, setCache } from "@/lib/server/route-cache";

interface EspnStandingStat {
  name?: string;
  value?: number;
  displayValue?: string;
}

interface EspnStandingEntry {
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logos?: Array<{ href?: string }>;
  };
  stats?: EspnStandingStat[];
}

function statValue(stats: EspnStandingStat[] | undefined, key: string): number {
  const found = stats?.find((item) => item.name === key);
  const value = Number(found?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function toIsoDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function clampDate(date: Date, minDate: Date, maxDate: Date): Date {
  if (date.getTime() < minDate.getTime()) return new Date(minDate);
  if (date.getTime() > maxDate.getTime()) return new Date(maxDate);
  return date;
}

function deriveFormByTeam(matches: Match[]) {
  const byTeam = new Map<number, Match[]>();
  for (const match of matches) {
    const homeId = match.homeTeam.id;
    const awayId = match.awayTeam.id;
    if (!byTeam.has(homeId)) byTeam.set(homeId, []);
    if (!byTeam.has(awayId)) byTeam.set(awayId, []);
    byTeam.get(homeId)?.push(match);
    byTeam.get(awayId)?.push(match);
  }

  const formByTeam = new Map<number, string | null>();
  for (const [teamId, teamMatches] of byTeam.entries()) {
    const latestFive = [...teamMatches]
      .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
      .slice(0, 5);

    if (latestFive.length === 0) {
      formByTeam.set(teamId, null);
      continue;
    }

    const form = latestFive
      .map((match) => {
        const home = match.score.fullTime.home;
        const away = match.score.fullTime.away;
        if (home === null || away === null) return null;
        const isHome = match.homeTeam.id === teamId;
        if (home === away) return "D";
        if (isHome) return home > away ? "W" : "L";
        return away > home ? "W" : "L";
      })
      .filter((value): value is "W" | "D" | "L" => value === "W" || value === "D" || value === "L")
      .join(",");

    formByTeam.set(teamId, form || null);
  }

  return formByTeam;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league");

  if (!league || !(league in LEAGUES)) {
    return NextResponse.json(
      { error: "Missing or invalid league parameter" },
      { status: 400 }
    );
  }

  const leagueId = league as LeagueId;
  const espnLeagueCode = LEAGUES[leagueId].espnLeagueCode;
  const cacheKey = `standings:v3:${leagueId}`;

  const freshCached = getFreshCache<StandingsResponse>(cacheKey);
  if (freshCached) {
    return NextResponse.json(freshCached);
  }

  try {
    const data = await fetchEspnJson<{
      children?: Array<{ standings?: { entries?: EspnStandingEntry[] } }>;
    }>(`https://site.api.espn.com/apis/v2/sports/soccer/${espnLeagueCode}/standings`);

    const entries = data.children?.[0]?.standings?.entries || [];
    const now = new Date();
    const since = addDays(now, -180);
    const trackedTeamIds = new Set<number>(
      entries
        .map((entry) => Number(entry.team?.id || 0))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
    const formCounts = new Map<number, number>();
    const finishedMatches: Match[] = [];
    const seenMatchIds = new Set<number>();
    const chunkDays = 14;
    let chunkEnd = new Date(now);

    while (chunkEnd.getTime() >= since.getTime()) {
      const chunkStart = clampDate(
        addDays(chunkEnd, -(chunkDays - 1)),
        since,
        now
      );
      const chunkEvents = await fetchLeagueScoreboard(
        leagueId,
        toIsoDateString(chunkStart),
        toIsoDateString(chunkEnd)
      );
      const mappedChunk = chunkEvents
        .map((event) => mapScoreboardEventToMatch(event))
        .filter((match): match is Match => match !== null && match.status === "FINISHED");

      for (const match of mappedChunk) {
        if (seenMatchIds.has(match.id)) continue;
        seenMatchIds.add(match.id);
        finishedMatches.push(match);

        if (trackedTeamIds.has(match.homeTeam.id)) {
          formCounts.set(match.homeTeam.id, (formCounts.get(match.homeTeam.id) || 0) + 1);
        }
        if (trackedTeamIds.has(match.awayTeam.id)) {
          formCounts.set(match.awayTeam.id, (formCounts.get(match.awayTeam.id) || 0) + 1);
        }
      }

      const allTeamsCovered = Array.from(trackedTeamIds).every(
        (teamId) => (formCounts.get(teamId) || 0) >= 5
      );
      if (allTeamsCovered) {
        break;
      }

      chunkEnd = addDays(chunkStart, -1);
    }

    const formByTeam = deriveFormByTeam(finishedMatches);

    const table: TablePosition[] = entries.map((entry) => {
      const teamId = Number(entry.team?.id || 0);
      const stats = entry.stats || [];
      return {
        position: statValue(stats, "rank"),
        team: {
          id: Number.isFinite(teamId) ? teamId : 0,
          name: entry.team?.displayName || "Unknown",
          shortName: entry.team?.shortDisplayName || entry.team?.displayName || "Unknown",
          tla: entry.team?.abbreviation || "",
          crest: entry.team?.logos?.[0]?.href || null,
        },
        playedGames: statValue(stats, "gamesPlayed"),
        won: statValue(stats, "wins"),
        draw: statValue(stats, "ties"),
        lost: statValue(stats, "losses"),
        points: statValue(stats, "points"),
        goalsFor: statValue(stats, "pointsFor"),
        goalsAgainst: statValue(stats, "pointsAgainst"),
        goalDifference: statValue(stats, "pointDifferential"),
        form: formByTeam.get(teamId) || null,
      };
    });

    const response: StandingsResponse = {
      competition: buildCompetitionMeta(leagueId),
      standings: [
        {
          stage: "REGULAR_SEASON",
          type: "TOTAL",
          group: null,
          table,
        },
      ],
    };

    setCache(cacheKey, response, 10 * 60 * 1000, 60 * 60 * 1000);
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch standings";
    console.error("ESPN standings error:", message);
    const stale = getStaleCache<StandingsResponse>(cacheKey);
    if (stale) {
      return NextResponse.json({
        ...stale,
        _meta: { stale: true, message: "Serving cached standings due to upstream error." },
      });
    }
    return NextResponse.json({ errorCode: 500, message }, { status: 500 });
  }
}
