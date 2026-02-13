import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { AnyNode } from "domhandler";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import { ScorerEntry, ScorersResponse } from "@/lib/api/types";
import { buildCompetitionMeta, ESPN_HEADERS } from "@/lib/server/espn";
import { getFreshCache, getStaleCache, setCache } from "@/lib/server/route-cache";

function parseIdFromHref(href: string | undefined, pattern: RegExp): number {
  if (!href) return 0;
  const match = href.match(pattern);
  const value = Number(match?.[1] || 0);
  return Number.isFinite(value) ? value : 0;
}

function parseInteger(value: string): number {
  const parsed = Number(value.replace(/[^\d-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league");
  const limit = Number(searchParams.get("limit") || 10);

  if (!league || !(league in LEAGUES)) {
    return NextResponse.json(
      { error: "Missing or invalid league parameter" },
      { status: 400 }
    );
  }

  const leagueId = league as LeagueId;
  const espnLeagueCode = LEAGUES[leagueId].espnLeagueCode.toUpperCase();
  const url = `https://www.espn.com/soccer/stats/_/league/${espnLeagueCode}/view/scoring`;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
  const cacheKey = `scorers:${leagueId}:${safeLimit}`;

  const freshCached = getFreshCache<ScorersResponse>(cacheKey);
  if (freshCached) {
    return NextResponse.json(freshCached);
  }

  try {
    const response = await fetch(url, {
      headers: ESPN_HEADERS,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { errorCode: response.status, message: `Failed to fetch scorers (${response.status})` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const tables = $("table");
    const scorersTable = tables.eq(0);
    const assistsTable = tables.eq(1);

    const map = new Map<string, ScorerEntry>();
    const parseTable = (
      table: cheerio.Cheerio<AnyNode>,
      metric: "goals" | "assists"
    ) => {
      table.find("tbody tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 5) return;

        const playerCell = cells.eq(1);
        const teamCell = cells.eq(2);
        const playedCell = cells.eq(3);
        const valueCell = cells.eq(4);

        const playerLink = playerCell.find("a").first();
        const teamLink = teamCell.find("a").first();

        const playerName = playerLink.text().trim();
        const teamName = teamLink.text().trim();
        const playerId = parseIdFromHref(playerLink.attr("href"), /\/id\/(\d+)/);
        const teamId = parseIdFromHref(teamLink.attr("href"), /\/id\/(\d+)/);
        const metricValue = parseInteger(valueCell.text().trim());
        const playedMatches = parseInteger(playedCell.text().trim());

        if (!playerName || !teamName || metricValue < 0) return;

        const key = `${playerId || playerName}-${teamId || teamName}`;
        const existing = map.get(key);
        if (existing) {
          if (metric === "goals") existing.goals = metricValue;
          if (metric === "assists") existing.assists = metricValue;
          if (playedMatches > 0) existing.playedMatches = playedMatches;
          return;
        }

        const scorerEntry: ScorerEntry = {
          player: {
            id: playerId,
            name: playerName,
          },
          team: {
            id: teamId,
            name: teamName,
            shortName: teamName,
            tla: "",
            crest: null,
          },
          playedMatches: playedMatches > 0 ? playedMatches : null,
          goals: metric === "goals" ? metricValue : 0,
          assists: metric === "assists" ? metricValue : 0,
          penalties: null,
        };

        map.set(key, scorerEntry);
      });
    };

    parseTable(scorersTable, "goals");
    parseTable(assistsTable, "assists");

    const scorers = Array.from(map.values())
      .sort((a, b) => (b.goals || 0) - (a.goals || 0))
      .slice(0, safeLimit);

    const payload: ScorersResponse = {
      count: scorers.length,
      scorers,
      competition: buildCompetitionMeta(leagueId),
    };

    setCache(cacheKey, payload, 10 * 60 * 1000, 60 * 60 * 1000);
    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scrape scorers";
    console.error("ESPN scorers error:", message);
    const stale = getStaleCache<ScorersResponse>(cacheKey);
    if (stale) {
      return NextResponse.json({
        ...stale,
        _meta: { stale: true, message: "Serving cached scorers due to upstream error." },
      });
    }
    return NextResponse.json({ errorCode: 500, message }, { status: 500 });
  }
}
