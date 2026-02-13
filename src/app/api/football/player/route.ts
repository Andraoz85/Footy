import { NextResponse } from "next/server";
import { club, player as transfermarktPlayer } from "transfermarkt-parser";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import { PlayerProfileResponse, ScorerEntry } from "@/lib/api/types";
import { getFreshCache, getStaleCache, setCache } from "@/lib/server/route-cache";

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLikelyCurrentSeasonStartYear(date = new Date()): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= 7 ? year : year - 1;
}

function parseLeagueId(leagueRaw: string | null): LeagueId | null {
  return leagueRaw && leagueRaw in LEAGUES ? (leagueRaw as LeagueId) : null;
}

function buildEspnLeagueCodes(
  preferred: LeagueId | null,
  options: { strictPreferred?: boolean } = {}
): string[] {
  const preferredCode = preferred ? LEAGUES[preferred].espnLeagueCode : null;
  if (preferredCode && options.strictPreferred) {
    return [preferredCode];
  }
  const all = Object.values(LEAGUES).map((league) => league.espnLeagueCode);
  return preferredCode
    ? [preferredCode, ...all.filter((code) => code !== preferredCode)]
    : all;
}

interface EspnRosterStat {
  name?: string;
  value?: number;
}

interface EspnRosterAthlete {
  id?: string;
  displayName?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  citizenship?: string;
  age?: number;
  headshot?: { href?: string };
  position?: { displayName?: string };
  statistics?: {
    splits?: {
      categories?: Array<{
        stats?: EspnRosterStat[];
      }>;
    };
  };
}

function normalizeTeamName(value: string) {
  return value
    .toLowerCase()
    .replace(/\d+/g, " ")
    .replace(/\b(fc|cf|sc|afc|ac)\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLooseTeamMatch(left: string, right: string) {
  const a = normalizeTeamName(left);
  const b = normalizeTeamName(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  const aInB = Array.from(aTokens).every((token) => bTokens.has(token));
  const bInA = Array.from(bTokens).every((token) => aTokens.has(token));
  return aInB || bInA;
}

function findStatValue(
  athlete: EspnRosterAthlete | null,
  statNames: string[]
): number | null {
  if (!athlete?.statistics?.splits?.categories?.length) return null;
  const stats = athlete.statistics.splits.categories.flatMap(
    (category) => category.stats || []
  );
  for (const name of statNames) {
    const found = stats.find((stat) => stat.name === name);
    const value = Number(found?.value);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

async function fetchTeamRosterAthlete(
  leagueId: LeagueId | null,
  teamId: number | null,
  teamName: string | null,
  playerId: number,
  playerName: string | null
) {
  if (!leagueId) return null;
  const leagueCode = LEAGUES[leagueId].espnLeagueCode;

  let resolvedTeamId = teamId && teamId > 0 ? teamId : null;
  if (!resolvedTeamId && teamName) {
    const standingsResponse = await fetch(
      `https://site.api.espn.com/apis/v2/sports/soccer/${leagueCode}/standings`,
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "accept-language": "en-US,en;q=0.9",
        },
        cache: "no-store",
      }
    ).catch(() => null);
    if (standingsResponse?.ok) {
      const standingsData = (await standingsResponse.json()) as {
        children?: Array<{
          standings?: {
            entries?: Array<{
              team?: { id?: string; displayName?: string; shortDisplayName?: string };
            }>;
          };
        }>;
      };
      const entries = standingsData.children?.[0]?.standings?.entries || [];
      const matched = entries.find((entry) =>
        isLooseTeamMatch(
          entry.team?.displayName || entry.team?.shortDisplayName || "",
          teamName
        )
      );
      const parsed = Number(matched?.team?.id || 0);
      resolvedTeamId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
  }

  if (!resolvedTeamId) return null;
  const rosterResponse = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/teams/${resolvedTeamId}/roster`,
    {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    }
  ).catch(() => null);

  if (!rosterResponse?.ok) return null;
  const rosterData = (await rosterResponse.json()) as {
    team?: {
      id?: string;
      displayName?: string;
      shortDisplayName?: string;
      abbreviation?: string;
      logo?: string;
      name?: string;
    };
    athletes?: EspnRosterAthlete[];
  };

  const athletes = rosterData.athletes || [];
  const matchedById =
    playerId > 0
      ? athletes.find((athlete) => Number(athlete.id || 0) === playerId)
      : null;

  const normalizedPlayerName = normalizeName(playerName || "");
  const matchedByName =
    matchedById ||
    athletes.find((athlete) => normalizeName(athlete.displayName || "") === normalizedPlayerName) ||
    athletes.find((athlete) => normalizeName(athlete.fullName || "") === normalizedPlayerName) ||
    athletes.find((athlete) => {
      const candidate =
        normalizeName(athlete.displayName || "") || normalizeName(athlete.fullName || "");
      return (
        candidate.includes(normalizedPlayerName) ||
        normalizedPlayerName.includes(candidate)
      );
    }) ||
    null;

  return {
    team: rosterData.team || null,
    athlete: matchedByName,
  };
}

async function fetchEspnAthlete(
  playerId: number,
  preferredLeague: LeagueId | null,
  options: { strictPreferred?: boolean } = {}
) {
  const leagueCodes = buildEspnLeagueCodes(preferredLeague, options);
  for (const code of leagueCodes) {
    const response = await fetch(
      `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${code}/athletes/${playerId}?lang=en&region=us`,
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "accept-language": "en-US,en;q=0.9",
        },
        cache: "no-store",
      }
    );
    if (!response.ok) continue;
    const data = await response.json();
    if (data?.id) {
      return data as {
        id: string;
        firstName?: string;
        lastName?: string;
        displayName?: string;
        dateOfBirth?: string;
        citizenship?: string;
        age?: number;
        position?: { displayName?: string };
      };
    }
  }
  return null;
}

async function fetchLeagueScorers(requestUrl: string, leagueId: LeagueId | null) {
  if (!leagueId) return [] as ScorerEntry[];
  const target = new URL("/api/football/scorers", requestUrl);
  target.searchParams.set("league", leagueId);
  target.searchParams.set("limit", "400");
  const response = await fetch(target.toString(), { cache: "no-store" });
  if (!response.ok) return [] as ScorerEntry[];
  const data = (await response.json()) as { scorers?: ScorerEntry[] };
  return data.scorers || [];
}

async function fetchTransfermarktPhotoAndMeta(
  leagueId: LeagueId | null,
  teamName: string | null,
  playerName: string | null
) {
  if (!leagueId || !teamName || !playerName) {
    return {
      photo: null as string | null,
      dateOfBirth: null as string | null,
      nationality: null as string | null,
      position: null as string | null,
      age: null as number | null,
    };
  }

  try {
    const season = getLikelyCurrentSeasonStartYear();
    const preferredCompetitionId = LEAGUES[leagueId].transfermarktCompetitionId;
    const competitionIds = Array.from(
      new Set([
        preferredCompetitionId,
        ...Object.values(LEAGUES).map((entry) => entry.transfermarktCompetitionId),
      ])
    );

    let matchedTeam: { id?: number; title?: string } | undefined;
    for (const competitionId of competitionIds) {
      const teamsBySeason = await Promise.all([
        club.list(competitionId, season.toString()).catch(() => []),
        club.list(competitionId, (season - 1).toString()).catch(() => []),
      ]);
      const teams = [...teamsBySeason[0], ...teamsBySeason[1]];
      matchedTeam = teams.find((entry) => isLooseTeamMatch(entry.title || "", teamName));
      if (matchedTeam?.id) break;
    }

    if (!matchedTeam?.id) {
      return {
        photo: null as string | null,
        dateOfBirth: null as string | null,
        nationality: null as string | null,
        position: null as string | null,
        age: null as number | null,
      };
    }

    let squad = await transfermarktPlayer.list(matchedTeam.id, season.toString());
    if (!squad.length) {
      squad = await transfermarktPlayer.list(matchedTeam.id, (season - 1).toString());
    }
    const normalizedPlayer = normalizeName(playerName);
    const matchedPlayer =
      squad.find((entry) => normalizeName(entry.name || "") === normalizedPlayer) ||
      squad.find((entry) => {
        const n = normalizeName(entry.name || "");
        return n.includes(normalizedPlayer) || normalizedPlayer.includes(n);
      });

    if (!matchedPlayer) {
      return {
        photo: null as string | null,
        dateOfBirth: null as string | null,
        nationality: null as string | null,
        position: null as string | null,
        age: null as number | null,
      };
    }

    return {
      photo: matchedPlayer.photoUrl || null,
      dateOfBirth: matchedPlayer.birthday || null,
      nationality: matchedPlayer.nationalities?.[0] || null,
      position: matchedPlayer.position || null,
      age: null as number | null,
    };
  } catch {
    return {
      photo: null as string | null,
      dateOfBirth: null as string | null,
      nationality: null as string | null,
      position: null as string | null,
      age: null as number | null,
    };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = Number(searchParams.get("playerId") || 0);
  const leagueId = parseLeagueId(searchParams.get("league"));
  const playerNameRaw = searchParams.get("name");
  const playerNameClean = playerNameRaw
    ? playerNameRaw.replace(/\s+/g, " ").trim()
    : null;
  const teamIdRaw = Number(searchParams.get("teamId") || 0);
  const teamNameRaw = searchParams.get("teamName");

  if (!playerId && !playerNameRaw) {
    return NextResponse.json(
      { error: "Missing playerId or name parameter" },
      { status: 400 }
    );
  }

  const cacheKey = `player:v4:${playerId || "none"}:${leagueId || "none"}:${
    playerNameClean || "none"
  }:${teamIdRaw || "none"}`;

  const fresh = getFreshCache<PlayerProfileResponse>(cacheKey);
  if (fresh) return NextResponse.json(fresh);

  try {
    const [espnAthlete, scorers] = await Promise.all([
      playerId > 0
        ? fetchEspnAthlete(playerId, leagueId, { strictPreferred: Boolean(leagueId) })
        : Promise.resolve(null),
      fetchLeagueScorers(request.url, leagueId),
    ]);

    const normalizedQueryName = normalizeName(
      playerNameClean || espnAthlete?.displayName || ""
    );
    const scorerEntry =
      scorers.find((entry) => entry.player.id === playerId) ||
      scorers.find((entry) => normalizeName(entry.player.name) === normalizedQueryName) ||
      null;

    const resolvedTeamName = scorerEntry?.team.name || teamNameRaw || null;
    const resolvedNameForLookup =
      scorerEntry?.player.name ||
      playerNameClean ||
      espnAthlete?.displayName ||
      null;
    const resolvedTeamIdForLookup =
      scorerEntry?.team.id || (Number.isFinite(teamIdRaw) && teamIdRaw > 0 ? teamIdRaw : 0);
    const rosterResolved = await fetchTeamRosterAthlete(
      leagueId,
      resolvedTeamIdForLookup || null,
      resolvedTeamName,
      playerId,
      resolvedNameForLookup
    ).catch(() => null);

    const transfermarktMeta = await fetchTransfermarktPhotoAndMeta(
      leagueId,
      resolvedTeamName,
      resolvedNameForLookup
    );

    const resolvedPlayerId = scorerEntry?.player.id || playerId || 0;
    const resolvedName =
      scorerEntry?.player.name ||
      rosterResolved?.athlete?.displayName ||
      rosterResolved?.athlete?.fullName ||
      playerNameClean ||
      espnAthlete?.displayName ||
      "Unknown Player";
    const espnAthleteMatchesResolvedName =
      Boolean(espnAthlete?.displayName) &&
      normalizeName(espnAthlete?.displayName || "") === normalizeName(resolvedName);
    const safeEspnAthlete = espnAthleteMatchesResolvedName ? espnAthlete : null;
    const resolvedTeamId =
      scorerEntry?.team.id ||
      Number(rosterResolved?.team?.id || 0) ||
      (Number.isFinite(teamIdRaw) ? teamIdRaw : 0);
    const rosterAthlete = rosterResolved?.athlete || null;
    const rosterGoals = findStatValue(rosterAthlete, ["totalGoals", "goals"]);
    const rosterAssists = findStatValue(rosterAthlete, ["goalAssists", "assists"]);
    const rosterPlayedMatches = findStatValue(rosterAthlete, ["appearances", "gamesPlayed"]);
    const rosterPenalties = findStatValue(rosterAthlete, ["penaltyGoals", "penaltiesScored"]);

    const payload: PlayerProfileResponse = {
      player: {
        id: resolvedPlayerId,
        name: resolvedName,
        firstName: rosterAthlete?.firstName || safeEspnAthlete?.firstName || null,
        lastName: rosterAthlete?.lastName || safeEspnAthlete?.lastName || null,
        dateOfBirth:
          scorerEntry?.player.dateOfBirth ||
          rosterAthlete?.dateOfBirth ||
          safeEspnAthlete?.dateOfBirth ||
          transfermarktMeta.dateOfBirth ||
          null,
        nationality:
          scorerEntry?.player.nationality ||
          rosterAthlete?.citizenship ||
          safeEspnAthlete?.citizenship ||
          transfermarktMeta.nationality ||
          null,
        position:
          scorerEntry?.player.position ||
          rosterAthlete?.position?.displayName ||
          safeEspnAthlete?.position?.displayName ||
          transfermarktMeta.position ||
          null,
        photo: transfermarktMeta.photo || rosterAthlete?.headshot?.href || null,
        age: rosterAthlete?.age || safeEspnAthlete?.age || null,
      },
      team:
        resolvedTeamId || resolvedTeamName
          ? {
              id: resolvedTeamId || 0,
              name:
                resolvedTeamName ||
                rosterResolved?.team?.displayName ||
                rosterResolved?.team?.name ||
                rosterResolved?.team?.shortDisplayName ||
                "Unknown Team",
              shortName:
                scorerEntry?.team.shortName ||
                rosterResolved?.team?.shortDisplayName ||
                rosterResolved?.team?.name ||
                resolvedTeamName ||
                "Unknown Team",
              tla: scorerEntry?.team.tla || rosterResolved?.team?.abbreviation || "",
              crest: scorerEntry?.team.crest || rosterResolved?.team?.logo || null,
            }
          : null,
      stats: {
        goals: scorerEntry?.goals ?? rosterGoals ?? null,
        assists: scorerEntry?.assists ?? rosterAssists ?? null,
        penalties: scorerEntry?.penalties ?? rosterPenalties ?? null,
        playedMatches: scorerEntry?.playedMatches ?? rosterPlayedMatches ?? null,
      },
      source: "espn core + espn roster + espn scoring + transfermarkt roster",
    };

    setCache(cacheKey, payload, 20 * 60 * 1000, 2 * 60 * 60 * 1000);
    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch player profile";
    console.error("Player profile error:", message);
    const stale = getStaleCache<PlayerProfileResponse>(cacheKey);
    if (stale) {
      return NextResponse.json({
        ...stale,
        _meta: { stale: true, message: "Serving cached player profile due to upstream error." },
      });
    }
    return NextResponse.json({ errorCode: 500, message }, { status: 500 });
  }
}
