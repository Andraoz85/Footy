import { MatchResponse } from "./types";

export const LEAGUES = {
  PL: {
    id: "PL",
    name: "Premier League",
    emblem: "https://crests.football-data.org/PL.png",
  },
  ELC: {
    id: "ELC",
    name: "Championship",
    emblem: "https://crests.football-data.org/ELC.png",
  },
  SA: {
    id: "SA",
    name: "Serie A",
    emblem: "https://crests.football-data.org/SA.png",
  },
  PD: {
    id: "PD",
    name: "La Liga",
    emblem: "https://crests.football-data.org/PD.png",
  },
  BL1: {
    id: "BL1",
    name: "Bundesliga",
    emblem: "https://crests.football-data.org/BL1.png",
  },
  FL1: {
    id: "FL1",
    name: "Ligue 1",
    emblem: "https://crests.football-data.org/FL1.png",
  },
  CL: {
    id: "CL",
    name: "Champions League",
    emblem: "https://crests.football-data.org/CL.png",
  },
} as const;

export type LeagueId = keyof typeof LEAGUES;

const CACHE_KEY = "football_matches_cache";
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

async function fetchFromApi<T>(endpoint: string): Promise<T> {
  try {
    const url = `/api/football?endpoint=${encodeURIComponent(endpoint)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(
          "API rate limit reached. Please try again in a minute."
        );
      }
      throw new Error(
        data.error || `Failed to fetch data (${response.status})`
      );
    }

    return data;
  } catch (err) {
    const error = err as Error;
    console.error("Fetch error:", error.message);
    throw error;
  }
}

function getCachedMatches() {
  // Check if we are in the browser
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
  } catch (error) {
    // If something goes wrong, remove the cache
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
  dateTo.setDate(dateTo.getDate() + 30);
  const dateToStr = dateTo.toISOString().split("T")[0];

  const results: { [key in LeagueId]?: MatchResponse } = {};

  try {
    // Get data for each league
    for (const leagueId of leagueIds) {
      try {
        const response = await fetchFromApi<MatchResponse>(
          `/competitions/${leagueId}/matches?dateFrom=${dateFrom}&dateTo=${dateToStr}&status=SCHEDULED`
        );
        if (response && response.matches) {
          results[leagueId] = response;
        }
      } catch (error) {
        console.error(
          `Failed to fetch matches for ${LEAGUES[leagueId].name}:`,
          error
        );
      }
      // Wait between each call to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Save to cache
    saveToCache(results);

    return results;
  } catch (error) {
    console.error("Error fetching matches:", error);
    throw error;
  }
}
