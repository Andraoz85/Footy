import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import { Match, Team } from "@/lib/api/types";

const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

export const ESPN_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
};

export function toEspnDate(date: string | Date): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

export function mapEspnStatusToMatchStatus(event: { status?: { type?: { completed?: boolean; state?: string } } }): Match["status"] {
  if (event.status?.type?.completed) return "FINISHED";
  if (event.status?.type?.state === "in") return "IN_PLAY";
  return "SCHEDULED";
}

function parseEspnTeam(team: {
  id?: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  logo?: string;
  logos?: Array<{ href?: string }>;
}): Team {
  const crest =
    team.logos?.find((logo) => typeof logo?.href === "string" && logo.href.length > 0)
      ?.href ||
    (typeof team.logo === "string" && team.logo.length > 0 ? team.logo : null);
  const id = Number(team.id || 0);
  return {
    id: Number.isFinite(id) ? id : 0,
    name: team.displayName || "Unknown",
    shortName: team.shortDisplayName || team.displayName || "Unknown",
    tla: team.abbreviation || "",
    crest,
  };
}

export function buildCompetitionMeta(leagueId: LeagueId) {
  const league = LEAGUES[leagueId];
  return {
    id: league.apiFootballLeagueId,
    name: league.name,
    code: league.id,
    emblem: league.emblem,
    type: "LEAGUE",
  };
}

export async function fetchEspnJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: ESPN_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ESPN request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function fetchLeagueScoreboard(
  leagueId: LeagueId,
  dateFrom: string,
  dateTo: string
): Promise<Array<Record<string, unknown>>> {
  const code = LEAGUES[leagueId].espnLeagueCode;
  const from = toEspnDate(dateFrom);
  const to = toEspnDate(dateTo);
  const data = await fetchEspnJson<{ events?: Array<Record<string, unknown>> }>(
    `${ESPN_API_BASE}/${code}/scoreboard?dates=${from}-${to}`
  );
  return data.events || [];
}

export function mapScoreboardEventToMatch(event: Record<string, unknown>): Match | null {
  const competition = Array.isArray(event.competitions)
    ? (event.competitions[0] as Record<string, unknown> | undefined)
    : undefined;
  const competitors = Array.isArray(competition?.competitors)
    ? (competition?.competitors as Array<Record<string, unknown>>)
    : [];

  const home = competitors.find(
    (item) => (item.homeAway as string | undefined) === "home"
  );
  const away = competitors.find(
    (item) => (item.homeAway as string | undefined) === "away"
  );

  if (!home || !away) return null;

  const homeTeam = parseEspnTeam((home.team || {}) as Record<string, unknown>);
  const awayTeam = parseEspnTeam((away.team || {}) as Record<string, unknown>);

  const id = Number(event.id || 0);
  const homeScore = Number(home.score || 0);
  const awayScore = Number(away.score || 0);
  const status = mapEspnStatusToMatchStatus(event as never);

  return {
    id: Number.isFinite(id) ? id : 0,
    utcDate: (event.date as string | undefined) || new Date().toISOString(),
    status,
    matchday: Number((event.week as { number?: number } | undefined)?.number || 0),
    stage:
      ((event.seasonType as { name?: string } | undefined)?.name as string | undefined) ||
      "Regular Season",
    homeTeam,
    awayTeam,
    score: {
      fullTime: {
        home: status === "FINISHED" ? homeScore : null,
        away: status === "FINISHED" ? awayScore : null,
      },
    },
  };
}
