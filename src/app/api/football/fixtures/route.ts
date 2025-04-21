import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");

  if (!endpoint) {
    return NextResponse.json(
      { error: "Missing endpoint parameter" },
      { status: 400 }
    );
  }

  const API_KEY = process.env.FOOTBALL_API_KEY;
  const API_BASE = "https://api.football-data.org/v4";

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "X-Auth-Token": API_KEY || "",
      },
    });

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