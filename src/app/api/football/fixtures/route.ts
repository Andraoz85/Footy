import { NextResponse } from "next/server";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import {
  buildCompetitionMeta,
  fetchLeagueScoreboard,
  mapScoreboardEventToMatch,
} from "@/lib/server/espn";
import { Match } from "@/lib/api/types";
import { getFreshCache, getStaleCache, setCache } from "@/lib/server/route-cache";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");

  if (!endpoint) {
    return NextResponse.json(
      { error: "Missing endpoint parameter" },
      { status: 400 }
    );
  }

  const match = endpoint.match(/^\/competitions\/([^/]+)\/matches(?:\?(.*))?$/);
  if (!match) {
    return NextResponse.json(
      { error: "Invalid endpoint parameter" },
      { status: 400 }
    );
  }

  const leagueId = match[1] as LeagueId;
  if (!(leagueId in LEAGUES)) {
    return NextResponse.json(
      { error: "Unsupported competition code" },
      { status: 400 }
    );
  }

  const endpointParams = new URLSearchParams(match[2] || "");
  const status = normalizeStatus(endpointParams.get("status"));
  const limit = Number(endpointParams.get("limit") || 0);

  const now = new Date();
  const defaultFrom = new Date(now);
  const defaultTo = new Date(now);
  if (status === "FINISHED") {
    defaultFrom.setDate(defaultFrom.getDate() - 45);
  } else {
    defaultTo.setDate(defaultTo.getDate() + 45);
  }

  const dateFrom = parseDate(endpointParams.get("dateFrom"), defaultFrom);
  const dateTo = parseDate(endpointParams.get("dateTo"), defaultTo);
  const cacheKey = `fixtures:v2:${leagueId}:${status}:${dateFrom}:${dateTo}:${limit || "none"}`;

  const freshCached = getFreshCache<Record<string, unknown>>(cacheKey);
  if (freshCached) {
    return NextResponse.json(freshCached);
  }

  try {
    const events = await fetchLeagueScoreboard(leagueId, dateFrom, dateTo);
    let matches = events
      .map((event) => mapScoreboardEventToMatch(event))
      .filter((item): item is Match => item !== null);

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

    const payload = {
      competition: buildCompetitionMeta(leagueId),
      matches,
    };
    setCache(cacheKey, payload, 2 * 60 * 1000, 20 * 60 * 1000);
    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch fixtures";
    console.error("ESPN fixtures error:", message);
    const stale = getStaleCache<Record<string, unknown>>(cacheKey);
    if (stale) {
      return NextResponse.json({
        ...stale,
        _meta: { stale: true, message: "Serving cached fixtures due to upstream error." },
      });
    }
    return NextResponse.json({ errorCode: 500, message }, { status: 500 });
  }
}
