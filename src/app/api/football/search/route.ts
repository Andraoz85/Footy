import { NextResponse } from "next/server";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import { CompetitionTeamsResponse, ScorersResponse } from "@/lib/api/types";
import { getFreshCache, getStaleCache, setCache } from "@/lib/server/route-cache";

type SearchResultType = "competition" | "team" | "player";

interface SearchResultItem {
  type: SearchResultType;
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  score: number;
}

function normalizeQuery(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(text: string, query: string) {
  const normalizedText = normalizeQuery(text);
  if (!normalizedText || !query) return 0;
  if (normalizedText === query) return 120;
  if (normalizedText.startsWith(query)) return 90;
  const words = normalizedText.split(" ");
  if (words.some((word) => word.startsWith(query))) return 70;
  if (normalizedText.includes(query)) return 40;
  return 0;
}

async function fetchLeagueTeams(origin: string, leagueId: LeagueId) {
  const response = await fetch(
    `${origin}/api/football/teams?league=${encodeURIComponent(leagueId)}`,
    {
      cache: "no-store",
    }
  );
  if (!response.ok) return null;
  return (await response.json()) as CompetitionTeamsResponse;
}

async function fetchLeagueScorers(origin: string, leagueId: LeagueId) {
  const response = await fetch(
    `${origin}/api/football/scorers?league=${encodeURIComponent(leagueId)}&limit=220`,
    {
      cache: "no-store",
    }
  );
  if (!response.ok) return null;
  return (await response.json()) as ScorersResponse;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const normalized = normalizeQuery(rawQuery);

  if (normalized.length < 2) {
    return NextResponse.json({
      query: rawQuery,
      results: [] as Array<Omit<SearchResultItem, "score">>,
    });
  }

  const cacheKey = `search:v1:${normalized}`;
  const fresh = getFreshCache<{ query: string; results: Array<Omit<SearchResultItem, "score">> }>(
    cacheKey
  );
  if (fresh) {
    return NextResponse.json(fresh);
  }

  try {
    const leagueIds = Object.keys(LEAGUES) as LeagueId[];
    const [teamResults, scorerResults] = await Promise.all([
      Promise.allSettled(leagueIds.map((leagueId) => fetchLeagueTeams(origin, leagueId))),
      Promise.allSettled(leagueIds.map((leagueId) => fetchLeagueScorers(origin, leagueId))),
    ]);

    const results: SearchResultItem[] = [];

    for (const leagueId of leagueIds) {
      const league = LEAGUES[leagueId];
      const competitionScore = Math.max(scoreMatch(league.name, normalized), scoreMatch(league.id, normalized));
      if (competitionScore > 0) {
        results.push({
          type: "competition",
          id: leagueId,
          label: league.name,
          sublabel: "Competition",
          href: `/competition/${leagueId}`,
          score: competitionScore + 10,
        });
      }
    }

    const seenTeams = new Set<string>();
    teamResults.forEach((result, index) => {
      if (result.status !== "fulfilled" || !result.value?.teams) return;
      const leagueId = leagueIds[index];
      const leagueName = LEAGUES[leagueId].name;
      for (const team of result.value.teams) {
        const score = Math.max(scoreMatch(team.name, normalized), scoreMatch(team.shortName, normalized));
        if (score <= 0) continue;
        const key = `${team.id}-${leagueId}`;
        if (seenTeams.has(key)) continue;
        seenTeams.add(key);
        results.push({
          type: "team",
          id: key,
          label: team.name,
          sublabel: leagueName,
          href: `/team/${team.id}?league=${leagueId}`,
          score: score + 6,
        });
      }
    });

    const seenPlayers = new Set<string>();
    scorerResults.forEach((result, index) => {
      if (result.status !== "fulfilled" || !result.value?.scorers) return;
      const leagueId = leagueIds[index];
      for (const scorer of result.value.scorers) {
        const score = scoreMatch(scorer.player.name, normalized);
        if (score <= 0) continue;
        const playerId = scorer.player.id;
        if (!playerId || !Number.isFinite(playerId)) continue;
        const key = `${playerId}-${leagueId}`;
        if (seenPlayers.has(key)) continue;
        seenPlayers.add(key);
        results.push({
          type: "player",
          id: key,
          label: scorer.player.name,
          sublabel: `${scorer.team.name} • ${LEAGUES[leagueId].name}`,
          href: `/player/${playerId}?league=${leagueId}&name=${encodeURIComponent(
            scorer.player.name
          )}&teamId=${scorer.team.id}&teamName=${encodeURIComponent(scorer.team.name)}`,
          score: score + 2,
        });
      }
    });

    results.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
    const payload = {
      query: rawQuery,
      results: results.slice(0, 18).map((item) => ({
        type: item.type,
        id: item.id,
        label: item.label,
        sublabel: item.sublabel,
        href: item.href,
      })),
    };

    setCache(cacheKey, payload, 2 * 60 * 1000, 20 * 60 * 1000);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    const stale = getStaleCache<{ query: string; results: Array<Omit<SearchResultItem, "score">> }>(
      cacheKey
    );
    if (stale) {
      return NextResponse.json({
        ...stale,
        _meta: { stale: true, message: "Serving cached search due to upstream error." },
      });
    }
    return NextResponse.json({ errorCode: 500, message }, { status: 500 });
  }
}
