import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { LEAGUES, LeagueId } from "@/lib/api/leagues";
import { ScrapedStatEntry } from "@/lib/api/types";
import { getFreshCache, getStaleCache, setCache } from "@/lib/server/route-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CACHE_TTL_MS = 15 * 60 * 1000;
const espnLeagueMap: Record<LeagueId, string> = {
  PL: "ENG.1",
  ELC: "ENG.2",
  SA: "ITA.1",
  PD: "ESP.1",
  BL1: "GER.1",
  FL1: "FRA.1",
  CL: "UEFA.CHAMPIONS",
};

function getLikelyCurrentSeasonStartYear(date = new Date()) {
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= 7 ? year : year - 1;
}

function parseInteger(value: string): number {
  const parsed = Number(value.replace(/[^\d-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchTransfermarktPage(path: string) {
  const response = await fetch(`https://www.transfermarkt.com${path}`, {
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Transfermarkt request failed (${response.status})`);
  }

  return response.text();
}

function normalizeTeamName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|ac)\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchEspnLeagueTeams(espnLeagueCode: string) {
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeagueCode.toLowerCase()}/teams`,
    {
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    }
  );
  if (!response.ok) return [];
  const data = (await response.json()) as {
    sports?: Array<{
      leagues?: Array<{
        teams?: Array<{ team?: { id?: string; displayName?: string; shortDisplayName?: string } }>;
      }>;
    }>;
  };
  const teams = data.sports?.[0]?.leagues?.[0]?.teams || [];
  return teams
    .map((entry) => ({
      id: Number(entry.team?.id || 0),
      name: entry.team?.displayName || "",
      shortName: entry.team?.shortDisplayName || "",
    }))
    .filter((team) => team.id && team.name);
}

function buildTeamLookup(teams: Array<{ id: number; name: string; shortName: string }>) {
  return teams.map((team) => ({
    id: team.id,
    normalizedName: normalizeTeamName(team.name),
    normalizedShort: normalizeTeamName(team.shortName),
  }));
}

function resolveTeamId(
  teamName: string,
  lookup: Array<{ id: number; normalizedName: string; normalizedShort: string }>
): number | null {
  const normalized = normalizeTeamName(teamName);
  if (!normalized) return null;

  const exact = lookup.find(
    (team) => team.normalizedName === normalized || team.normalizedShort === normalized
  );
  if (exact) return exact.id;

  const partial = lookup.find(
    (team) =>
      team.normalizedName.includes(normalized) ||
      normalized.includes(team.normalizedName) ||
      team.normalizedShort.includes(normalized) ||
      normalized.includes(team.normalizedShort)
  );
  return partial?.id || null;
}

async function scrapeEspnDisciplineStats(
  espnLeagueCode: string,
  teamLookup: Array<{ id: number; normalizedName: string; normalizedShort: string }>
) {
  const url = `https://www.espn.com/soccer/stats/_/league/${espnLeagueCode}/view/discipline/sort/redCards/dir/desc`;
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ESPN discipline request failed (${response.status})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const rows = $("table tbody tr").toArray();

  const yellowCards: ScrapedStatEntry[] = [];
  const redCards: ScrapedStatEntry[] = [];

  rows.forEach((row) => {
    const cells = $(row).children("td");
    const teamName = cells.eq(1).find("a").first().text().trim();
    const yellow = parseInteger(cells.eq(3).text());
    const redTotal = parseInteger(cells.eq(4).text());
    const teamId = resolveTeamId(teamName, teamLookup);

    if (!teamName) return;
    if (yellow > 0) {
      yellowCards.push({ player: teamName, team: "-", value: yellow, entityId: teamId });
    }
    if (redTotal > 0) {
      redCards.push({ player: teamName, team: "-", value: redTotal, entityId: teamId });
    }
  });

  yellowCards.sort((a, b) => b.value - a.value);
  redCards.sort((a, b) => b.value - a.value);

  return { yellowCards, redCards };
}

async function scrapeShotsOnTargetStats(
  competitionId: string,
  season: number,
  teamLookup: Array<{ id: number; normalizedName: string; normalizedShort: string }>
) {
  const html = await fetchTransfermarktPage(
    `/-/chancenverwertung/wettbewerb/${competitionId}/saison_id/${season}`
  );
  const $ = cheerio.load(html);
  const rows = $("table.items tbody tr").toArray();

  const shotsOnTarget: ScrapedStatEntry[] = [];

  rows.forEach((row) => {
    const cells = $(row).children("td");
    const teamName = cells.eq(1).find("a").first().text().trim();
    const shots = parseInteger(cells.eq(2).text());
    const teamId = resolveTeamId(teamName, teamLookup);

    if (!teamName || shots <= 0) return;
    shotsOnTarget.push({ player: teamName, team: "-", value: shots, entityId: teamId });
  });

  shotsOnTarget.sort((a, b) => b.value - a.value);
  return shotsOnTarget;
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
  const competitionId = LEAGUES[leagueId].transfermarktCompetitionId;
  const espnLeagueCode = espnLeagueMap[leagueId];
  const season = getLikelyCurrentSeasonStartYear();
  const cacheKey = `scraped-stats:${leagueId}`;
  const freshCached = getFreshCache<Record<string, unknown>>(cacheKey);
  if (freshCached) return NextResponse.json(freshCached);

  try {
    const teams = await fetchEspnLeagueTeams(espnLeagueCode);
    const teamLookup = buildTeamLookup(teams);
    const [disciplineStats, shotsOnTarget] = await Promise.all([
      scrapeEspnDisciplineStats(espnLeagueCode, teamLookup),
      scrapeShotsOnTargetStats(competitionId, season, teamLookup),
    ]);

    const payload = {
      league: leagueId,
      source: "espn.com (discipline) + transfermarkt.com (shots)",
      fetchedAt: new Date().toISOString(),
      redCards: disciplineStats.redCards.slice(0, 30),
      yellowCards: disciplineStats.yellowCards.slice(0, 30),
      shotsOnTarget: shotsOnTarget.slice(0, 30),
    };

    setCache(cacheKey, payload, CACHE_TTL_MS, 2 * 60 * 60 * 1000);
    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scrape competition stats";
    console.error("Scraped stats error:", message);
    const stale = getStaleCache<Record<string, unknown>>(cacheKey);
    if (stale) {
      return NextResponse.json({
        ...stale,
        _meta: { stale: true, message: "Serving cached extra stats due to upstream error." },
      });
    }
    return NextResponse.json({ errorCode: 500, message }, { status: 500 });
  }
}
