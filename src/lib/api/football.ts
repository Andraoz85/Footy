import {
  CompetitionTeamsResponse,
  MatchResponse,
  PlayerProfileResponse,
  ScorersResponse,
  ScrapedCompetitionStatsResponse,
  StandingsResponse,
  TablePosition,
  TeamDetailsResponse,
  TeamExtraDataResponse,
  TeamMatchesResponse,
} from "./types";
import { LeagueId, LEAGUES } from "./leagues";

const CACHE_KEY = "football_matches_cache";
const CACHE_TIME = 60 * 60 * 1000; // 60 minutes
export const DAYS_TO_FETCH = 14;
const inFlightRequests = new Map<string, Promise<unknown>>();
const SCORERS_CACHE_TIME = 30 * 60 * 1000;
const TEAMS_CACHE_TIME = 60 * 60 * 1000;
const TEAM_DETAILS_CACHE_TIME = 60 * 60 * 1000;
const TEAM_MATCHES_CACHE_TIME = 15 * 60 * 1000;
const TEAM_EXTRA_CACHE_TIME = 60 * 60 * 1000;
const COMPETITION_MATCHES_CACHE_TIME = 10 * 60 * 1000;
const SCRAPED_STATS_CACHE_TIME = 30 * 60 * 1000;

export function getLikelyCurrentSeasonStartYear(date = new Date()): number {
  const month = date.getMonth(); // 0-based
  const year = date.getFullYear();
  return month >= 7 ? year : year - 1;
}

async function fetchFromApi<T>(url: string): Promise<T> {
  const pendingRequest = inFlightRequests.get(url);
  if (pendingRequest) {
    return pendingRequest as Promise<T>;
  }

  const requestPromise: Promise<T> = (async () => {
    try {
      const response = await fetch(url);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            "API rate limit reached. Please try again in a minute."
          );
        }

        const message =
          data?.message ||
          data?.error ||
          `Failed to fetch data (${response.status})`;

        throw new Error(
          typeof message === "string"
            ? message
            : `Failed to fetch data (${response.status})`
        );
      }

      return data as T;
    } catch (err) {
      const error = err as Error;
      console.error("Fetch error:", error.message);
      throw error;
    }
  })();

  inFlightRequests.set(url, requestPromise);
  requestPromise.finally(() => inFlightRequests.delete(url));
  return requestPromise;
}

function getCachedMatches() {
  if (typeof window === "undefined") return null;

  try {
    // Get cached data from localStorage
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    // Convert from JSON to JavaScript object
    const { timestamp, data } = JSON.parse(cached);

    // Check if the cache is old
    if (Date.now() - timestamp > CACHE_TIME) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data;
  } catch (err) {
    // remove cache if error
    console.error("Error reading from cache:", err);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function saveToCache(data: { [key in LeagueId]?: MatchResponse }) {
  if (typeof window === "undefined") return;

  try {
    // Save data with current timestamp
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch (error) {
    console.error("Failed to save to cache:", error);
  }
}

export async function getUpcomingMatches(
  leagueIds: LeagueId[] = Object.keys(LEAGUES) as LeagueId[]
): Promise<{ [key in LeagueId]?: MatchResponse }> {
  // Try to get data from cache first
  const cachedData = getCachedMatches();
  if (cachedData) {
    return cachedData;
  }

  const today = new Date();
  const dateFrom = today.toISOString().split("T")[0];

  const dateTo = new Date(today);
  dateTo.setDate(dateTo.getDate() + DAYS_TO_FETCH);
  const dateToStr = dateTo.toISOString().split("T")[0];

  const results: { [key in LeagueId]?: MatchResponse } = {};

  const requests = leagueIds.map(async (leagueId) => {
    const endpoint = `/competitions/${leagueId}/matches?dateFrom=${dateFrom}&dateTo=${dateToStr}&status=SCHEDULED`;
    const response = await fetchFromApi<MatchResponse>(
      `/api/football/fixtures?endpoint=${encodeURIComponent(endpoint)}`
    );

    return { leagueId, response };
  });

  const settledResponses = await Promise.allSettled(requests);

  settledResponses.forEach((result, index) => {
    if (result.status === "fulfilled") {
      const { leagueId, response } = result.value;
      if (response && response.matches) {
        results[leagueId] = response;
      }
      return;
    }

    const leagueId = leagueIds[index];
    console.error(
      `Failed to fetch matches for ${LEAGUES[leagueId].name}:`,
      result.reason
    );
  });

  if (Object.keys(results).length > 0) {
    saveToCache(results);
  }

  return results;
}

interface CompetitionMatchesOptions {
  status?: "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export async function getCompetitionMatches(
  leagueId: LeagueId,
  options: CompetitionMatchesOptions = {}
): Promise<MatchResponse> {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.dateFrom) params.set("dateFrom", options.dateFrom);
  if (options.dateTo) params.set("dateTo", options.dateTo);
  if (options.limit) params.set("limit", options.limit.toString());

  const endpoint = `/competitions/${leagueId}/matches${
    params.toString() ? `?${params.toString()}` : ""
  }`;
  const cacheKey = `competition_matches_${leagueId}_${options.status || "all"}_${
    options.dateFrom || "none"
  }_${options.dateTo || "none"}_${options.limit || "none"}`;
  const cachedData = getCachedData<MatchResponse>(
    cacheKey,
    COMPETITION_MATCHES_CACHE_TIME
  );
  if (cachedData) {
    return cachedData;
  }

  const response = await fetchFromApi<MatchResponse>(
    `/api/football/fixtures?endpoint=${encodeURIComponent(endpoint)}`
  );

  saveDataToCache(cacheKey, response);
  return response;
}

export async function getLeagueStandings(
  leagueId: LeagueId,
  season = getLikelyCurrentSeasonStartYear()
): Promise<StandingsResponse> {
  // caching
  const cacheKey = `standings_${leagueId}_${season}`;
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  try {
    const response = await fetchFromApi<StandingsResponse>(
      `/api/football/standings?league=${encodeURIComponent(
        leagueId
      )}&season=${encodeURIComponent(season.toString())}`
    );

    // save to cache
    saveStandingsToCache(cacheKey, response);
    return response;
  } catch (error) {
    console.error(
      `Failed to fetch standings for ${LEAGUES[leagueId].name}:`,
      error
    );
    throw error;
  }
}

export async function getTopScorers(
  leagueId: LeagueId,
  limit = 10,
  season = getLikelyCurrentSeasonStartYear()
): Promise<ScorersResponse> {
  const cacheKey = `top_scorers_${leagueId}_${limit}_${season}`;
  const cachedData = getCachedData<ScorersResponse>(
    cacheKey,
    SCORERS_CACHE_TIME
  );
  if (cachedData) {
    return cachedData;
  }

  const response = await fetchFromApi<ScorersResponse>(
    `/api/football/scorers?league=${encodeURIComponent(
      leagueId
    )}&limit=${encodeURIComponent(limit.toString())}&season=${encodeURIComponent(
      season.toString()
    )}`
  );

  saveDataToCache(cacheKey, response);
  return response;
}

export async function getCompetitionTeams(
  leagueId: LeagueId
): Promise<CompetitionTeamsResponse> {
  const cacheKey = `competition_teams_${leagueId}`;
  const cachedData = getCachedData<CompetitionTeamsResponse>(
    cacheKey,
    TEAMS_CACHE_TIME
  );
  if (cachedData) {
    return cachedData;
  }

  const response = await fetchFromApi<CompetitionTeamsResponse>(
    `/api/football/teams?league=${encodeURIComponent(leagueId)}`
  );

  saveDataToCache(cacheKey, response);
  return response;
}

export async function getTeamDetails(
  teamId: number,
  leagueId?: LeagueId
): Promise<TeamDetailsResponse> {
  const cacheKey = `team_details_v3_${teamId}_${leagueId || "any"}`;
  const cachedData = getCachedData<TeamDetailsResponse>(
    cacheKey,
    TEAM_DETAILS_CACHE_TIME
  );
  if (cachedData) {
    return cachedData;
  }

  const response = await fetchFromApi<TeamDetailsResponse>(
    `/api/football/team?teamId=${encodeURIComponent(teamId.toString())}${
      leagueId ? `&league=${encodeURIComponent(leagueId)}` : ""
    }`
  );

  saveDataToCache(cacheKey, response);
  return response;
}

interface GetTeamMatchesOptions {
  status?: "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED";
  limit?: number;
  leagueId?: LeagueId;
  dateFrom?: string;
  dateTo?: string;
}

export async function getTeamMatches(
  teamId: number,
  options: GetTeamMatchesOptions = {}
): Promise<TeamMatchesResponse> {
  const params = new URLSearchParams({
    teamId: teamId.toString(),
    resource: "matches",
  });

  if (options.status) params.set("status", options.status);
  if (options.limit) params.set("limit", options.limit.toString());
  if (options.leagueId) params.set("league", options.leagueId);
  if (options.dateFrom) params.set("dateFrom", options.dateFrom);
  if (options.dateTo) params.set("dateTo", options.dateTo);

  const cacheKey = `team_matches_${teamId}_${options.status || "ALL"}_${
    options.limit || "none"
  }_${options.leagueId || "all"}_${options.dateFrom || "none"}_${
    options.dateTo || "none"
  }`;
  const cachedData = getCachedData<TeamMatchesResponse>(
    cacheKey,
    TEAM_MATCHES_CACHE_TIME
  );
  if (cachedData) {
    return cachedData;
  }

  const response = await fetchFromApi<TeamMatchesResponse>(
    `/api/football/team?${params.toString()}`
  );

  saveDataToCache(cacheKey, response);
  return response;
}

export async function getTeamStandingRow(
  leagueId: LeagueId,
  teamId: number,
  season = getLikelyCurrentSeasonStartYear()
): Promise<{ teamRow: TablePosition | null; table: TablePosition[] }> {
  const standingsResponse = await getLeagueStandings(leagueId, season);
  const normalizedStandings =
    standingsResponse.standings?.filter((group) => group.type === "TOTAL").length
      ? standingsResponse.standings.filter((group) => group.type === "TOTAL")
      : standingsResponse.standings || [];

  const table = normalizedStandings[0]?.table || [];
  return {
    teamRow: table.find((row) => row.team.id === teamId) || null,
    table,
  };
}

export async function getTeamExtraData(
  teamName: string,
  country?: string,
  leagueId?: LeagueId,
  season?: number
): Promise<TeamExtraDataResponse> {
  const cacheKey = `team_extra_${teamName}_${country || "none"}_${
    leagueId || "none"
  }_${season || "none"}`;
  const cachedData = getCachedData<TeamExtraDataResponse>(
    cacheKey,
    TEAM_EXTRA_CACHE_TIME
  );
  if (cachedData) {
    return cachedData;
  }

  const params = new URLSearchParams({
    teamName,
  });
  if (country) {
    params.set("country", country);
  }
  if (leagueId) {
    params.set("league", leagueId);
  }
  if (season) {
    params.set("season", season.toString());
  }

  const response = await fetchFromApi<TeamExtraDataResponse>(
    `/api/football/team-extra?${params.toString()}`
  );
  saveDataToCache(cacheKey, response);
  return response;
}

export async function getScrapedCompetitionStats(
  leagueId: LeagueId
): Promise<ScrapedCompetitionStatsResponse> {
  const cacheKey = `scraped_stats_v2_${leagueId}`;
  const cachedData = getCachedData<ScrapedCompetitionStatsResponse>(
    cacheKey,
    SCRAPED_STATS_CACHE_TIME
  );
  if (
    cachedData &&
    typeof cachedData.source === "string" &&
    cachedData.source.includes("espn.com")
  ) {
    return cachedData;
  }

  const response = await fetchFromApi<ScrapedCompetitionStatsResponse>(
    `/api/football/scraped-stats?league=${encodeURIComponent(leagueId)}`
  );

  saveDataToCache(cacheKey, response);
  return response;
}

interface GetPlayerProfileOptions {
  leagueId?: LeagueId | null;
  playerName?: string | null;
  teamId?: number | null;
  teamName?: string | null;
}

export async function getPlayerProfile(
  playerId: number,
  options: GetPlayerProfileOptions = {}
): Promise<PlayerProfileResponse> {
  const params = new URLSearchParams();
  if (playerId > 0) params.set("playerId", playerId.toString());
  if (options.leagueId) params.set("league", options.leagueId);
  if (options.playerName) params.set("name", options.playerName);
  if (options.teamId) params.set("teamId", options.teamId.toString());
  if (options.teamName) params.set("teamName", options.teamName);

  const cacheKey = `player_profile_v3_${playerId}_${options.leagueId || "none"}_${
    options.playerName || "none"
  }_${options.teamId || "none"}_${options.teamName || "none"}`;
  const cachedData = getCachedData<PlayerProfileResponse>(cacheKey, 20 * 60 * 1000);
  if (cachedData) {
    return cachedData;
  }

  const response = await fetchFromApi<PlayerProfileResponse>(
    `/api/football/player?${params.toString()}`
  );
  saveDataToCache(cacheKey, response);
  return response;
}

function getCachedData<T>(key: string, cacheTimeMs = 30 * 60 * 1000): T | null {
  if (typeof window === "undefined") return null;

  const cached = localStorage.getItem(key);
  if (!cached) return null;

  try {
    const { timestamp, data } = JSON.parse(cached);
    if (Date.now() - timestamp > cacheTimeMs) {
      localStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch (err) {
    console.error("Error reading from cache:", err);
    localStorage.removeItem(key);
    return null;
  }
}

function saveDataToCache<T>(key: string, data: T) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch (error) {
    console.error("Failed to save to cache:", error);
  }
}

function saveStandingsToCache(key: string, data: StandingsResponse) {
  saveDataToCache(key, data);
}
