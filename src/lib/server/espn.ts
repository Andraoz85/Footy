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

export function mapEspnStatusToMatchStatus(event: {
  status?: { type?: { completed?: boolean; state?: string } };
  competitions?: Array<{ status?: { type?: { completed?: boolean; state?: string } } }>;
}): Match["status"] {
  const statusType =
    event.status?.type || event.competitions?.[0]?.status?.type;
  if (statusType?.completed) return "FINISHED";
  if (statusType?.state === "in") return "IN_PLAY";
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

function parseCompetitorScore(
  score: unknown,
  status: Match["status"]
): number | null {
  if (status !== "FINISHED") return null;
  if (typeof score === "number" && Number.isFinite(score)) return score;
  if (typeof score === "string") {
    const parsed = Number(score);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (score && typeof score === "object") {
    const value = Number(
      (score as { value?: unknown; displayValue?: unknown }).value ??
        (score as { displayValue?: unknown }).displayValue
    );
    return Number.isFinite(value) ? value : null;
  }
  return null;
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

function asEventArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    : [];
}

export function extractEspnEvents(payload: unknown): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;

  const direct = asEventArray(root.events);
  if (direct.length > 0) return direct;

  const schedule =
    root.schedule && typeof root.schedule === "object"
      ? (root.schedule as Record<string, unknown>)
      : null;
  const scheduleEvents = schedule ? asEventArray(schedule.events) : [];
  if (scheduleEvents.length > 0) return scheduleEvents;

  const team = root.team && typeof root.team === "object" ? (root.team as Record<string, unknown>) : null;
  const teamSchedule =
    team?.schedule && typeof team.schedule === "object"
      ? (team.schedule as Record<string, unknown>)
      : null;
  const teamScheduleEvents = teamSchedule ? asEventArray(teamSchedule.events) : [];
  if (teamScheduleEvents.length > 0) return teamScheduleEvents;

  const nextEvent = team ? asEventArray(team.nextEvent) : [];
  if (nextEvent.length > 0) return nextEvent;

  const content =
    root.content && typeof root.content === "object"
      ? (root.content as Record<string, unknown>)
      : null;
  const contentSchedule =
    content?.schedule && typeof content.schedule === "object"
      ? (content.schedule as Record<string, unknown>)
      : null;
  const contentScheduleEvents = contentSchedule ? asEventArray(contentSchedule.events) : [];
  if (contentScheduleEvents.length > 0) return contentScheduleEvents;

  return [];
}

export async function fetchTeamScheduleEvents(
  teamId: number,
  dateFrom: string,
  dateTo: string,
  leagueCode?: string
): Promise<Array<Record<string, unknown>>> {
  const from = toEspnDate(dateFrom);
  const to = toEspnDate(dateTo);
  const prefix = leagueCode ? `${ESPN_API_BASE}/${leagueCode}` : ESPN_API_BASE;
  const data = await fetchEspnJson<Record<string, unknown>>(
    `${prefix}/teams/${teamId}/schedule?dates=${from}-${to}`
  );
  return extractEspnEvents(data);
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
  const status = mapEspnStatusToMatchStatus(event as never);
  const homeScore = parseCompetitorScore(home.score, status);
  const awayScore = parseCompetitorScore(away.score, status);
  const competitionMeta =
    competition?.competition && typeof competition.competition === "object"
      ? (competition.competition as Record<string, unknown>)
      : null;
  const eventLeague =
    event.league && typeof event.league === "object"
      ? (event.league as Record<string, unknown>)
      : null;
  const competitionName =
    (competitionMeta?.name as string | undefined) ||
    (competitionMeta?.displayName as string | undefined) ||
    (eventLeague?.name as string | undefined) ||
    (competition?.name as string | undefined) ||
    null;
  const competitionCode =
    (competitionMeta?.abbreviation as string | undefined) ||
    (competitionMeta?.slug as string | undefined) ||
    (eventLeague?.abbreviation as string | undefined) ||
    null;

  return {
    id: Number.isFinite(id) ? id : 0,
    utcDate: (event.date as string | undefined) || new Date().toISOString(),
    status,
    matchday: Number((event.week as { number?: number } | undefined)?.number || 0),
    stage:
      ((event.seasonType as { name?: string } | undefined)?.name as string | undefined) ||
      "Regular Season",
    competition: competitionName
      ? {
          name: competitionName,
          code: competitionCode,
        }
      : undefined,
    homeTeam,
    awayTeam,
    score: {
      fullTime: {
        home: homeScore,
        away: awayScore,
      },
    },
  };
}
