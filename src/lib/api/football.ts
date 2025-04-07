import { MatchResponse } from "./types";

async function fetchFromApi<T>(endpoint: string): Promise<T> {
  try {
    const url = `/api/football?endpoint=${encodeURIComponent(endpoint)}`;
    console.log("Client - Calling API route:", url);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("Client - API Error:", data);
      throw new Error(data.error || "Failed to fetch data");
    }

    return data;
  } catch (err) {
    const error = err as Error;
    console.error("Client - Detailed fetch error:", {
      error,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export async function testApiConnection(): Promise<any> {
  return fetchFromApi("/competitions/PL");
}

export async function getUpcomingMatches(
  leagueCode: string = "PL"
): Promise<MatchResponse> {
  const today = new Date();
  const dateFrom = today.toISOString().split("T")[0];

  // Set dateTo to 30 days from now
  const dateTo = new Date(today);
  dateTo.setDate(dateTo.getDate() + 30);
  const dateToStr = dateTo.toISOString().split("T")[0];

  console.log(
    "Client - Fetching matches from date:",
    dateFrom,
    "to:",
    dateToStr
  );

  return fetchFromApi<MatchResponse>(
    `/competitions/${leagueCode}/matches?dateFrom=${dateFrom}&dateTo=${dateToStr}&status=SCHEDULED`
  );
}
