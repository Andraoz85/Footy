import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league");

  if (!league) {
    return NextResponse.json(
      { error: "Missing league parameter" },
      { status: 400 }
    );
  }

  const API_KEY = process.env.FOOTBALL_API_KEY;
  const API_BASE = "https://api.football-data.org/v4";

  try {
    const response = await fetch(
      `${API_BASE}/competitions/${league}/standings`,
      {
        headers: {
          "X-Auth-Token": API_KEY || "",
        },
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        {
          errorCode: response.status,
          message: errorData.message || "Error fetching standings",
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data from football API" },
      { status: 500 }
    );
  }
}
