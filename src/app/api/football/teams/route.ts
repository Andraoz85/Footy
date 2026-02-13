import { NextResponse } from "next/server";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import { CompetitionTeamsResponse } from "@/lib/api/types";
import { buildCompetitionMeta, fetchEspnJson } from "@/lib/server/espn";
import { getFreshCache, getStaleCache, setCache } from "@/lib/server/route-cache";

interface EspnTeamWrapper {
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logos?: Array<{ href?: string }>;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league");

  if (!league || !(league in LEAGUES)) {
    return NextResponse.json(
      { error: "Missing or invalid league parameter" },
      { status: 400 }
    );
  }

  const leagueId = league as LeagueId;
  const espnLeagueCode = LEAGUES[leagueId].espnLeagueCode;
  const cacheKey = `teams:${leagueId}`;

  const freshCached = getFreshCache<CompetitionTeamsResponse>(cacheKey);
  if (freshCached) {
    return NextResponse.json(freshCached);
  }

  try {
    const data = await fetchEspnJson<{
      sports?: Array<{
        leagues?: Array<{
          teams?: EspnTeamWrapper[];
        }>;
      }>;
    }>(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeagueCode}/teams`);

    const teams =
      data.sports?.[0]?.leagues?.[0]?.teams?.map((item) => {
        const team = item.team || {};
        return {
          id: Number(team.id || 0),
          name: team.displayName || "Unknown",
          shortName: team.shortDisplayName || team.displayName || "Unknown",
          tla: team.abbreviation || "",
          crest: team.logos?.[0]?.href || null,
        };
      }) || [];

    const payload: CompetitionTeamsResponse = {
      count: teams.length,
      teams,
      competition: buildCompetitionMeta(leagueId),
    };

    setCache(cacheKey, payload, 30 * 60 * 1000, 2 * 60 * 60 * 1000);
    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch teams";
    console.error("ESPN teams error:", message);
    const stale = getStaleCache<CompetitionTeamsResponse>(cacheKey);
    if (stale) {
      return NextResponse.json({
        ...stale,
        _meta: { stale: true, message: "Serving cached teams due to upstream error." },
      });
    }
    return NextResponse.json({ errorCode: 500, message }, { status: 500 });
  }
}
