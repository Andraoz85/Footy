import { MatchResponse } from "./types";

export const LEAGUES = {
  PL: { id: "PL", name: "Premier League" },
  ELC: { id: "ELC", name: "Championship" },
  SA: { id: "SA", name: "Serie A" },
  PD: { id: "PD", name: "La Liga" },
  BL1: { id: "BL1", name: "Bundesliga" },
  FL1: { id: "FL1", name: "Ligue 1" },
  CL: { id: "CL", name: "Champions League" },
} as const;

export type LeagueId = keyof typeof LEAGUES;

async function fetchFromApi<T>(endpoint: string): Promise<T> {
  try {
    const url = `/api/football?endpoint=${encodeURIComponent(endpoint)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("API Error:", data.error || "Failed to fetch data");
      throw new Error(data.error || "Failed to fetch data");
    }

    return data;
  } catch (err) {
    const error = err as Error;
    console.error("Fetch error:", error.message);
    throw error;
  }
}

export async function getUpcomingMatches(
  leagueIds: LeagueId[] = Object.keys(LEAGUES) as LeagueId[]
): Promise<{ [key in LeagueId]?: MatchResponse }> {
  const today = new Date();
  const dateFrom = today.toISOString().split("T")[0];

  const dateTo = new Date(today);
  dateTo.setDate(dateTo.getDate() + 30);
  const dateToStr = dateTo.toISOString().split("T")[0];

  const results: { [key in LeagueId]?: MatchResponse } = {};

  await Promise.all(
    leagueIds.map(async (leagueId) => {
      try {
        const response = await fetchFromApi<MatchResponse>(
          `/competitions/${leagueId}/matches?dateFrom=${dateFrom}&dateTo=${dateToStr}&status=SCHEDULED`
        );
        results[leagueId] = response;
      } catch (error) {
        console.error(
          `Failed to fetch matches for ${LEAGUES[leagueId].name}:`,
          error
        );
      }
    })
  );

  return results;
}
