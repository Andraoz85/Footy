import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { club } from "transfermarkt-parser";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import {
  fetchEspnJson,
  fetchLeagueScoreboard,
  mapScoreboardEventToMatch,
} from "@/lib/server/espn";
import { Match, TeamDetailsResponse, TeamMatchesResponse } from "@/lib/api/types";
import { getFreshCache, getStaleCache, setCache } from "@/lib/server/route-cache";

interface EspnRosterResponse {
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logos?: Array<{ href?: string }>;
    color?: string;
    links?: Array<{ href?: string }>;
  };
  athletes?: Array<{
    id?: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    citizenship?: string;
    position?: { displayName?: string };
    jersey?: string;
  }>;
}

interface EspnCoreTeamResponse {
  id?: string;
  color?: string;
  alternateColor?: string;
  logos?: Array<{ href?: string }>;
  links?: Array<{ href?: string; rel?: string[] }>;
  venue?: {
    fullName?: string;
    address?: {
      country?: string;
    };
  };
}

const COLOR_PALETTE = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Red", hex: "#D4001F" },
  { name: "Blue", hex: "#0057B8" },
  { name: "Sky Blue", hex: "#87CEEB" },
  { name: "Navy", hex: "#0B1F3A" },
  { name: "Royal Blue", hex: "#1E3A8A" },
  { name: "Claret", hex: "#7A263A" },
  { name: "Burgundy", hex: "#800020" },
  { name: "Green", hex: "#00843D" },
  { name: "Dark Green", hex: "#004225" },
  { name: "Yellow", hex: "#FFD700" },
  { name: "Gold", hex: "#FDB913" },
  { name: "Orange", hex: "#F97316" },
  { name: "Purple", hex: "#6B21A8" },
  { name: "Brown", hex: "#7C4A2D" },
  { name: "Gray", hex: "#808080" },
  { name: "Silver", hex: "#C0C0C0" },
] as const;

function normalizeHex(value: string) {
  const raw = value.trim().replace(/^#/, "");
  if (raw.length === 3) {
    return `#${raw
      .split("")
      .map((ch) => ch + ch)
      .join("")
      .toUpperCase()}`;
  }
  if (raw.length === 6) return `#${raw.toUpperCase()}`;
  return null;
}

function hexToRgb(hex: string) {
  const value = normalizeHex(hex);
  if (!value) return null;
  const r = Number.parseInt(value.slice(1, 3), 16);
  const g = Number.parseInt(value.slice(3, 5), 16);
  const b = Number.parseInt(value.slice(5, 7), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

function nearestColorName(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  let bestName: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const color of COLOR_PALETTE) {
    const target = hexToRgb(color.hex);
    if (!target) continue;
    const distance =
      (rgb.r - target.r) ** 2 + (rgb.g - target.g) ** 2 + (rgb.b - target.b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestName = color.name;
    }
  }
  return bestName;
}

function toColorNames(value: string | null | undefined) {
  if (!value) return null;
  const parts = value.split("/").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const names = parts
    .map((part) => nearestColorName(part))
    .filter((name): name is string => Boolean(name));
  const uniqueNames = Array.from(new Set(names));
  return uniqueNames.length ? uniqueNames.join(" / ") : null;
}

function isEspnUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "espn.com" || hostname === "www.espn.com" || hostname.endsWith(".espn.com");
  } catch {
    return false;
  }
}

function pickOfficialWebsite(candidates: Array<string | null | undefined>) {
  const unique = Array.from(new Set(candidates.filter((value): value is string => Boolean(value))));
  const nonEspn = unique.find((url) => !isEspnUrl(url));
  return nonEspn || null;
}

function parseDate(value: string | null, fallback: Date): string {
  if (!value) return fallback.toISOString().split("T")[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback.toISOString().split("T")[0];
  return parsed.toISOString().split("T")[0];
}

function normalizeStatus(value: string | null): Match["status"] | "ALL" {
  if (!value) return "ALL";
  const upper = value.toUpperCase();
  if (
    upper === "SCHEDULED" ||
    upper === "TIMED" ||
    upper === "IN_PLAY" ||
    upper === "PAUSED" ||
    upper === "FINISHED" ||
    upper === "POSTPONED"
  ) {
    return upper;
  }
  return "ALL";
}

function getLikelyCurrentSeasonStartYear(date = new Date()) {
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= 7 ? year : year - 1;
}

function normalizeTeamName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\d+/g, " ")
    .replace(/\b(fc|cf|sc|afc|ac)\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLooseTeamMatch(left: string, right: string) {
  const a = normalizeTeamName(left);
  const b = normalizeTeamName(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  const aInB = Array.from(aTokens).every((token) => bTokens.has(token));
  const bInA = Array.from(bTokens).every((token) => aTokens.has(token));
  return aInB || bInA;
}

async function resolveTransfermarktTeamId(
  leagueId: LeagueId,
  teamName: string,
  season: number
) {
  const competitionId = LEAGUES[leagueId].transfermarktCompetitionId;
  const clubs = await club.list(competitionId, season.toString());
  const normalizedQuery = normalizeTeamName(teamName);
  const exact = clubs.find(
    (entry) => normalizeTeamName(entry.title || "") === normalizedQuery
  );
  const partial =
    exact ||
    clubs.find((entry) => {
      return isLooseTeamMatch(entry.title || "", teamName);
    });
  return partial?.id || null;
}

async function resolveTransfermarktTeamIdFromSearch(teamName: string) {
  const searchUrl = `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(
    teamName
  )}`;
  const response = await fetch(searchUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const html = await response.text();
  const $ = cheerio.load(html);
  const normalizedQuery = normalizeTeamName(teamName);

  const candidates: Array<{ id: number; name: string }> = [];
  const seen = new Set<number>();
  $('a[href*="/startseite/verein/"]').each((_, element) => {
    const href = $(element).attr("href") || "";
    const match = href.match(/\/verein\/(\d+)/);
    const id = match ? Number(match[1]) : NaN;
    const name = $(element).attr("title") || $(element).text().trim();
    if (!Number.isFinite(id) || !name || seen.has(id)) return;
    seen.add(id);
    candidates.push({ id, name });
  });

  const exact = candidates.find(
    (entry) => normalizeTeamName(entry.name) === normalizedQuery
  );
  const partial =
    exact ||
    candidates.find((entry) => {
      return isLooseTeamMatch(entry.name, teamName);
    });
  return partial?.id || null;
}

function extractFoundedYearFromText(value: string) {
  const match = value.match(/(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function normalizeWebsiteUrl(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

async function scrapeTransfermarktClubInfo(teamId: number) {
  const [startPageResponse, detailsPageResponse] = await Promise.all([
    fetch(`https://www.transfermarkt.com/-/startseite/verein/${teamId}`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    }),
    fetch(`https://www.transfermarkt.com/-/datenfakten/verein/${teamId}`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    }),
  ]);
  if (!startPageResponse.ok && !detailsPageResponse.ok) {
    return {
      founded: null as number | null,
      website: null as string | null,
      clubColorsText: null as string | null,
    };
  }

  const startHtml = startPageResponse.ok ? await startPageResponse.text() : "";
  const detailsHtml = detailsPageResponse.ok ? await detailsPageResponse.text() : "";
  const $ = cheerio.load(startHtml);
  const $$ = cheerio.load(detailsHtml);

  const colorHexes = new Set<string>();
  $$("th")
    .filter((_, el) => $$(el).text().toLowerCase().includes("club colours"))
    .each((_, th) => {
      $$(th)
        .next("td")
        .find("span[style*='background-color']")
        .each((__, span) => {
          const style = $$(span).attr("style") || "";
          const match = style.match(/background-color:\s*([^;]+)/i);
          if (!match) return;
          const normalized = normalizeHex(match[1]);
          if (normalized) colorHexes.add(normalized);
        });
    });

  const colorNames = Array.from(colorHexes)
    .map((hex) => nearestColorName(hex))
    .filter((value): value is string => Boolean(value));
  const uniqueColorNames = Array.from(new Set(colorNames));
  const clubColorsText =
    uniqueColorNames.length > 0 ? uniqueColorNames.join(" / ") : null;

  const foundedFromStart = extractFoundedYearFromText(
    $('[itemprop="foundingDate"]').first().text().trim()
  );
  const foundedFromDetails = extractFoundedYearFromText(
    $$("th")
      .filter((_, el) => {
        const text = $$(el).text().toLowerCase();
        return text.includes("founded");
      })
      .first()
      .next("td")
      .text()
      .trim()
  );
  const founded = foundedFromStart || foundedFromDetails;

  const websiteHref =
    $('[itemprop="url"] a').first().attr("href") ||
    $('[itemprop="url"]').first().attr("href") ||
    $$("th")
      .filter((_, el) => $$(el).text().toLowerCase().includes("website"))
      .first()
      .next("td")
      .find("a[href^='http']")
      .first()
      .attr("href") ||
    $("a[href^='http']")
      .filter((_, el) => /website/i.test($(el).text()))
      .first()
      .attr("href") ||
    null;
  const normalizedWebsite = normalizeWebsiteUrl(websiteHref);

  return {
    founded: Number.isFinite(founded as number) ? founded : null,
    website: normalizedWebsite,
    clubColorsText,
  };
}

async function fetchTeamRoster(leagueId: LeagueId, teamId: number) {
  const leagueCode = LEAGUES[leagueId].espnLeagueCode;
  return fetchEspnJson<EspnRosterResponse>(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/teams/${teamId}/roster`
  );
}

async function fetchTeamRosterFromAnyLeague(teamId: number, preferredLeague?: LeagueId) {
  const leagueOrder = (preferredLeague
    ? [preferredLeague, ...Object.keys(LEAGUES).filter((id) => id !== preferredLeague)]
    : Object.keys(LEAGUES)) as LeagueId[];

  for (const leagueId of leagueOrder) {
    try {
      const roster = await fetchTeamRoster(leagueId, teamId);
      if (roster.team?.id) {
        return { leagueId, roster };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamIdRaw = searchParams.get("teamId");
  const resource = searchParams.get("resource") || "details";
  const leagueRaw = searchParams.get("league");
  const status = normalizeStatus(searchParams.get("status"));
  const limit = Number(searchParams.get("limit") || 0);
  const dateFromRaw = searchParams.get("dateFrom");
  const dateToRaw = searchParams.get("dateTo");

  if (!teamIdRaw || !/^\d+$/.test(teamIdRaw)) {
    return NextResponse.json(
      { error: "Missing or invalid teamId parameter" },
      { status: 400 }
    );
  }

  if (resource !== "details" && resource !== "matches") {
    return NextResponse.json(
      { error: "Invalid resource parameter" },
      { status: 400 }
    );
  }

  const teamId = Number(teamIdRaw);
  const preferredLeague =
    leagueRaw && leagueRaw in LEAGUES ? (leagueRaw as LeagueId) : undefined;
  const cacheKey =
    resource === "details"
      ? `team:details:v7:${teamId}:${preferredLeague || "any"}`
      : `team:matches:v3:${teamId}:${preferredLeague || "any"}:${status}:${
          limit || "none"
        }:${dateFromRaw || "auto"}:${dateToRaw || "auto"}`;

  const freshCached = getFreshCache<TeamDetailsResponse | TeamMatchesResponse>(cacheKey);
  if (freshCached) {
    return NextResponse.json(freshCached);
  }

  try {
    if (resource === "details") {
      const resolved = await fetchTeamRosterFromAnyLeague(teamId, preferredLeague);
      if (!resolved) {
        return NextResponse.json(
          { errorCode: 404, message: "Team not found." },
          { status: 404 }
        );
      }

      const { leagueId, roster } = resolved;
      const team = roster.team || {};
      const season = getLikelyCurrentSeasonStartYear();
      const coreTeam = await fetchEspnJson<EspnCoreTeamResponse>(
        `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${LEAGUES[leagueId].espnLeagueCode}/seasons/${season}/teams/${teamId}?lang=en&region=us`
      ).catch(() => null);
      const transfermarktTeamId =
        (await resolveTransfermarktTeamId(
          leagueId,
          team.displayName || "",
          season
        ).catch(() => null)) ||
        (await resolveTransfermarktTeamIdFromSearch(team.displayName || "").catch(
          () => null
        ));
      const transfermarktInfo = transfermarktTeamId
        ? await scrapeTransfermarktClubInfo(transfermarktTeamId).catch(() => ({
            founded: null as number | null,
            website: null as string | null,
            clubColorsText: null as string | null,
          }))
        : {
            founded: null as number | null,
            website: null as string | null,
            clubColorsText: null as string | null,
          };

      const coreWebsite =
        coreTeam?.links?.find((link) => link.rel?.includes("clubhouse"))?.href ||
        coreTeam?.links?.[0]?.href ||
        null;

      const clubColorsHex = coreTeam?.color
        ? `#${coreTeam.color}${coreTeam.alternateColor ? ` / #${coreTeam.alternateColor}` : ""}`
        : null;
      const clubColors = toColorNames(clubColorsHex);
      const website = pickOfficialWebsite([transfermarktInfo.website, coreWebsite]);

      const payload: TeamDetailsResponse = {
        id: Number(team.id || teamId),
        name: team.displayName || "Unknown Team",
        shortName: team.shortDisplayName || team.displayName || "Unknown Team",
        tla: team.abbreviation || "",
        crest: team.logos?.[0]?.href || coreTeam?.logos?.[0]?.href || null,
        founded: transfermarktInfo.founded,
        venue: coreTeam?.venue?.fullName || null,
        clubColors: transfermarktInfo.clubColorsText || clubColors,
        website,
        area: {
          name: coreTeam?.venue?.address?.country || LEAGUES[leagueId].name,
          code: leagueId,
        },
        squad: (roster.athletes || []).map((player) => ({
          id: Number(player.id || 0),
          name: player.displayName || "Unknown",
          firstName: player.firstName || null,
          lastName: player.lastName || null,
          dateOfBirth: player.dateOfBirth || null,
          nationality: player.nationality || player.citizenship || null,
          position: player.position?.displayName || null,
          shirtNumber: Number(player.jersey || 0) || null,
        })),
      };

      setCache(cacheKey, payload, 20 * 60 * 1000, 2 * 60 * 60 * 1000);
      return NextResponse.json(payload);
    }

    const now = new Date();
    const defaultFrom = new Date(now);
    const defaultTo = new Date(now);
    if (status === "FINISHED") {
      defaultFrom.setDate(defaultFrom.getDate() - 90);
    } else {
      defaultTo.setDate(defaultTo.getDate() + 90);
    }

    const dateFrom = parseDate(dateFromRaw, defaultFrom);
    const dateTo = parseDate(dateToRaw, defaultTo);
    const leaguesToQuery: LeagueId[] = preferredLeague
      ? [preferredLeague]
      : (Object.keys(LEAGUES) as LeagueId[]);

    const allMatches: Match[] = [];
    for (const leagueId of leaguesToQuery) {
      const events = await fetchLeagueScoreboard(leagueId, dateFrom, dateTo);
      const leagueMatches = events
        .map((event) => mapScoreboardEventToMatch(event))
        .filter((item): item is Match => item !== null)
        .filter(
          (item) => item.homeTeam.id === teamId || item.awayTeam.id === teamId
        );
      allMatches.push(...leagueMatches);
    }

    let matches = allMatches;
    if (status !== "ALL") {
      if (status === "TIMED") {
        matches = matches.filter((item) => item.status === "SCHEDULED");
      } else {
        matches = matches.filter((item) => item.status === status);
      }
    }

    matches.sort((a, b) =>
      status === "FINISHED"
        ? new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
        : new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );

    if (Number.isFinite(limit) && limit > 0) {
      matches = matches.slice(0, limit);
    }

    const payload: TeamMatchesResponse = {
      matches,
      filters: {
        status: status === "ALL" ? undefined : status,
        competitions: preferredLeague,
        dateFrom,
        dateTo,
      },
    };

    setCache(cacheKey, payload, 5 * 60 * 1000, 30 * 60 * 1000);
    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch team data";
    console.error("ESPN team error:", message);
    const stale = getStaleCache<TeamDetailsResponse | TeamMatchesResponse>(cacheKey);
    if (stale) {
      return NextResponse.json({
        ...stale,
        _meta: { stale: true, message: "Serving cached team data due to upstream error." },
      });
    }
    return NextResponse.json({ errorCode: 500, message }, { status: 500 });
  }
}
