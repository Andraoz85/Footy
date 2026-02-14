import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { club } from "transfermarkt-parser";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import {
  fetchEspnJson,
  fetchLeagueScoreboard,
  fetchTeamScheduleEvents,
  mapScoreboardEventToMatch,
  toEspnDate,
} from "@/lib/server/espn";
import { Match, TeamDetailsResponse, TeamMatchesResponse } from "@/lib/api/types";
import { getFreshCache, getStaleCache, setCache } from "@/lib/server/route-cache";
const EXTRA_TEAM_SCHEDULE_CODES: readonly string[] = [
  "eng.fa",
  "eng.league_cup",
  "ita.coppa_italia",
  "esp.copa_del_rey",
  "ger.dfb_pokal",
  "fra.coupe_de_france",
  "uefa.europa",
  "uefa.europa.conf",
  "club.friendly",
];

const EXTRA_COMPETITION_LABELS: Record<string, string> = {
  "eng.fa": "English FA Cup",
  "eng.league_cup": "English Carabao Cup",
  "ita.coppa_italia": "Coppa Italia",
  "esp.copa_del_rey": "Copa del Rey",
  "ger.dfb_pokal": "DFB-Pokal",
  "fra.coupe_de_france": "Coupe de France",
  "uefa.europa": "UEFA Europa League",
  "uefa.europa.conf": "UEFA Europa Conference League",
  "club.friendly": "Club Friendly",
};

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

function isWithinDateRange(utcDate: string, dateFrom: string, dateTo: string): boolean {
  const matchDate = new Date(utcDate).getTime();
  const from = new Date(`${dateFrom}T00:00:00.000Z`).getTime();
  const to = new Date(`${dateTo}T23:59:59.999Z`).getTime();
  if (Number.isNaN(matchDate) || Number.isNaN(from) || Number.isNaN(to)) {
    return false;
  }
  return matchDate >= from && matchDate <= to;
}

function leagueCodeFromRef(ref: string | undefined): string | null {
  if (!ref) return null;
  const decodedRef = decodeURIComponent(ref);
  const directMatch = decodedRef.match(/\/leagues\/([^/?]+)/i);
  if (directMatch?.[1]) return directMatch[1];
  const queryMatch = decodedRef.match(/[?&](?:league|group)=([^&]+)/i);
  return queryMatch?.[1] || null;
}

function resolveCompetitionName(leagueCode: string | null, fallback: string): string {
  if (!leagueCode) return fallback;
  const knownLeague = Object.values(LEAGUES).find(
    (league) => league.espnLeagueCode === leagueCode
  );
  if (knownLeague) return knownLeague.name;
  return EXTRA_COMPETITION_LABELS[leagueCode] || fallback;
}

function toTitleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function humanizeLeagueCode(code: string): string {
  return toTitleCaseWords(code.replace(/[._-]+/g, " "));
}

interface EspnCoreTeamEventsResponse {
  items?: Array<{ $ref?: string }>;
}

interface EspnCoreEventCompetition {
  $ref?: string;
  name?: string;
  displayName?: string;
  competition?: {
    $ref?: string;
    name?: string;
    displayName?: string;
    abbreviation?: string;
  };
  competitors?: Array<{
    id?: string;
    homeAway?: "home" | "away";
  }>;
  status?: {
    type?: {
      completed?: boolean;
      state?: string;
    };
  };
}

interface EspnCoreEvent {
  id?: string;
  date?: string;
  name?: string;
  league?: {
    $ref?: string;
    name?: string;
    displayName?: string;
    shortName?: string;
    abbreviation?: string;
  };
  competitions?: EspnCoreEventCompetition[];
}

function resolveCoreCompetitionName(
  event: EspnCoreEvent,
  competition: EspnCoreEventCompetition | undefined,
  leagueCode: string | null
): string {
  const explicitName =
    event.league?.name ||
    event.league?.displayName ||
    event.league?.shortName ||
    competition?.competition?.name ||
    competition?.competition?.displayName ||
    competition?.name ||
    competition?.displayName;
  if (explicitName && explicitName.trim()) return explicitName.trim();
  if (leagueCode) {
    return resolveCompetitionName(leagueCode, humanizeLeagueCode(leagueCode));
  }
  return "Unknown competition";
}

function parseTeamsFromCoreEventName(name: string | undefined) {
  const raw = (name || "").trim();
  const match = raw.match(/^(.*?)\s+at\s+(.*?)$/i);
  if (!match) {
    return {
      awayName: "Away Team",
      homeName: "Home Team",
    };
  }
  return {
    awayName: match[1].trim(),
    homeName: match[2].trim(),
  };
}

function mapCoreEventToMatch(event: EspnCoreEvent): Match | null {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find((entry) => entry.homeAway === "home");
  const away = competitors.find((entry) => entry.homeAway === "away");
  if (!home || !away) return null;

  const id = Number(event.id || 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  const utcDate = event.date || null;
  if (!utcDate) return null;
  const names = parseTeamsFromCoreEventName(event.name);
  const statusType = competition?.status?.type;
  const status: Match["status"] =
    statusType?.completed
      ? "FINISHED"
      : statusType?.state === "in"
        ? "IN_PLAY"
        : "SCHEDULED";
  const nestedCompetitionRef = competition?.competition?.$ref;
  const leagueCode =
    leagueCodeFromRef(event.league?.$ref) ||
    leagueCodeFromRef(competition?.$ref) ||
    leagueCodeFromRef(nestedCompetitionRef);

  return {
    id,
    utcDate,
    status,
    matchday: 0,
    stage: "Regular Season",
    competition: {
      name: resolveCoreCompetitionName(event, competition, leagueCode),
      code: leagueCode || competition?.competition?.abbreviation || event.league?.abbreviation || null,
    },
    homeTeam: {
      id: Number(home.id || 0),
      name: names.homeName,
      shortName: names.homeName,
      tla: "",
      crest: null,
    },
    awayTeam: {
      id: Number(away.id || 0),
      name: names.awayName,
      shortName: names.awayName,
      tla: "",
      crest: null,
    },
    score: {
      fullTime: {
        home: null,
        away: null,
      },
    },
  };
}

async function fetchCoreTeamEvents(teamId: number, dateFrom: string, dateTo: string) {
  const index = await fetchEspnJson<EspnCoreTeamEventsResponse>(
    `https://sports.core.api.espn.com/v2/sports/soccer/teams/${teamId}/events?lang=en&region=us&limit=200&dates=${toEspnDate(
      dateFrom
    )}-${toEspnDate(dateTo)}`
  ).catch(() => null);
  const refs = (index?.items || [])
    .map((item) => item.$ref)
    .filter((ref): ref is string => Boolean(ref));
  if (refs.length === 0) return [] as Match[];

  const settled = await Promise.allSettled(
    refs.map((ref) =>
      fetchEspnJson<EspnCoreEvent>(ref)
        .then(mapCoreEventToMatch)
        .catch(() => null)
    )
  );

  return settled
    .filter(
      (entry): entry is PromiseFulfilledResult<Match | null> =>
        entry.status === "fulfilled"
    )
    .map((entry) => entry.value)
    .filter((match): match is Match => match !== null);
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
      : `team:matches:v9:${teamId}:${preferredLeague || "any"}:${status}:${
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
    const globalSeenIds = new Set<number>();
    const pushMatches = (matches: Match[]) => {
      for (const match of matches) {
        if (!isWithinDateRange(match.utcDate, dateFrom, dateTo)) continue;
        if (globalSeenIds.has(match.id)) continue;
        globalSeenIds.add(match.id);
        allMatches.push(match);
      }
    };

    // Prefer team-centric schedule endpoints so team pages can include cups/friendlies.
    const scheduleLeagueCodes = Array.from(
      new Set(
        [
          preferredLeague ? LEAGUES[preferredLeague].espnLeagueCode : undefined,
          ...Object.values(LEAGUES).map((entry) => entry.espnLeagueCode),
          ...EXTRA_TEAM_SCHEDULE_CODES,
        ].filter((value): value is string => typeof value === "string")
      )
    );
    const scheduleCandidates: Array<string | undefined> = [
      undefined, // global soccer team schedule endpoint
      ...scheduleLeagueCodes,
    ];

    for (const leagueCode of scheduleCandidates) {
      try {
        const events = await fetchTeamScheduleEvents(
          teamId,
          dateFrom,
          dateTo,
          leagueCode
        );
        const mapped = events
          .map((event) => mapScoreboardEventToMatch(event))
          .filter((item): item is Match => item !== null)
          .filter(
            (item) => item.homeTeam.id === teamId || item.awayTeam.id === teamId
          );
        pushMatches(mapped);

        const maxNeeded = Number.isFinite(limit) && limit > 0 ? limit * 3 : 0;
        if (maxNeeded > 0 && globalSeenIds.size >= maxNeeded) {
          break;
        }
      } catch {
        continue;
      }
    }

    if (status !== "FINISHED") {
      const coreMatches = await fetchCoreTeamEvents(teamId, dateFrom, dateTo).catch(
        () => [] as Match[]
      );
      pushMatches(coreMatches);
    }

    const hasFinishedFromSchedule = allMatches.some((match) => match.status === "FINISHED");
    const shouldUseLeagueFallback =
      allMatches.length === 0 || (status === "FINISHED" && !hasFinishedFromSchedule);

    // Fallback to league scoreboards if team schedule endpoint returns no usable data.
    if (shouldUseLeagueFallback) {
    for (const leagueId of leaguesToQuery) {
      const collectLeagueMatches = (events: Array<Record<string, unknown>>) => {
        const mapped = events
          .map((event) => mapScoreboardEventToMatch(event))
          .filter((item): item is Match => item !== null)
          .filter(
            (item) => item.homeTeam.id === teamId || item.awayTeam.id === teamId
          );
        pushMatches(mapped);
      };

      if (status === "FINISHED") {
        // ESPN scoreboard can omit newer matches for very large date windows.
        // Fetch backwards in smaller chunks so latest results are reliably included.
        const chunkDays = 14;
        const fromBoundary = new Date(`${dateFrom}T00:00:00.000Z`);
        const toBoundary = new Date(`${dateTo}T00:00:00.000Z`);
        let chunkEnd = new Date(toBoundary);

        while (chunkEnd.getTime() >= fromBoundary.getTime()) {
          const chunkStart = clampDate(
            addDays(chunkEnd, -(chunkDays - 1)),
            fromBoundary,
            toBoundary
          );
          const events = await fetchLeagueScoreboard(
            leagueId,
            toIsoDateString(chunkStart),
            toIsoDateString(chunkEnd)
          );
          collectLeagueMatches(events);

          const maxNeeded = Number.isFinite(limit) && limit > 0 ? limit * 3 : 0;
          if (maxNeeded > 0 && allMatches.length >= maxNeeded) {
            break;
          }

          chunkEnd = addDays(chunkStart, -1);
        }
      } else {
        const events = await fetchLeagueScoreboard(leagueId, dateFrom, dateTo);
        collectLeagueMatches(events);
      }
    }
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
