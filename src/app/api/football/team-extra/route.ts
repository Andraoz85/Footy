import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { club, player } from "transfermarkt-parser";
import { LEAGUES, LeagueId } from "@/lib/api/leagues";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ResolvedTeam {
  id: number;
  name: string;
  logo?: string | null;
  country?: string | null;
}

function sanitizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBirthDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = sanitizeText(value);
  if (!cleaned || /^invalid date$/i.test(cleaned)) return null;
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
}

function computeAgeFromBirthDate(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasBirthdayPassedThisYear =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasBirthdayPassedThisYear) age -= 1;
  return age >= 0 ? age : null;
}

function normalizeTeamName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|ac)\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLikelyCurrentSeasonStartYear(date = new Date()): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= 7 ? year : year - 1;
}

async function resolveTeamFromLeague(
  teamName: string,
  leagueId: LeagueId | null,
  season: number
): Promise<ResolvedTeam | null> {
  if (!leagueId) return null;
  const competitionId = LEAGUES[leagueId].transfermarktCompetitionId;
  if (!competitionId) return null;

  const clubs = await club.list(competitionId, season.toString());
  if (!clubs.length) return null;

  const normalizedQuery = normalizeTeamName(teamName);
  const exact = clubs.find(
    (entry) => normalizeTeamName(entry.title || "") === normalizedQuery
  );
  const partial = clubs.find((entry) => {
    const normalized = normalizeTeamName(entry.title || "");
    return normalized.includes(normalizedQuery) || normalizedQuery.includes(normalized);
  });
  const resolved = exact || partial || null;
  if (!resolved?.id || !resolved.title) return null;

  return {
    id: resolved.id,
    name: resolved.title,
    logo: resolved.logoUrl || null,
    country: null,
  };
}

async function resolveTeamFromSearch(teamName: string): Promise<ResolvedTeam | null> {
  const searchUrl = `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(
    teamName
  )}`;
  const response = await fetch(searchUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Transfermarkt search failed (${response.status})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const seen = new Set<number>();
  const candidates: ResolvedTeam[] = [];

  $('a[href*="/startseite/verein/"]').each((_, element) => {
    const href = $(element).attr("href") || "";
    const match = href.match(/\/verein\/(\d+)/);
    const id = match ? Number(match[1]) : NaN;
    const name = $(element).attr("title") || $(element).text().trim();

    if (!Number.isFinite(id) || !name || seen.has(id)) return;
    seen.add(id);
    candidates.push({
      id,
      name,
      logo: null,
      country: null,
    });
  });

  if (!candidates.length) return null;

  const normalizedQuery = normalizeTeamName(teamName);
  const exact = candidates.find(
    (entry) => normalizeTeamName(entry.name) === normalizedQuery
  );
  const partial = candidates.find((entry) => {
    const normalized = normalizeTeamName(entry.name);
    return normalized.includes(normalizedQuery) || normalizedQuery.includes(normalized);
  });

  return exact || partial || candidates[0];
}

async function scrapeTransfers(teamId: number, season: number, teamName: string) {
  const transfersUrl = `https://www.transfermarkt.com/-/transfers/verein/${teamId}/saison_id/${season}`;
  const response = await fetch(transfersUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Transfermarkt transfers page failed (${response.status})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const fetchTransferMeta = async (relativeUrl: string) => {
    if (!relativeUrl) return { date: null as string | null, fromTeam: null as string | null };
    const detailUrl = relativeUrl.startsWith("http")
      ? relativeUrl
      : `https://www.transfermarkt.com${relativeUrl}`;

    try {
      const detailResponse = await fetch(detailUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        cache: "no-store",
      });
      if (!detailResponse.ok) {
        return { date: null, fromTeam: null };
      }

      const detailHtml = await detailResponse.text();
      const $$ = cheerio.load(detailHtml);
      const ribbonTitle =
        $$("header.data-header .data-header__ribbon a").attr("title") || "";
      const dateMatch = ribbonTitle.match(/date:\s*([^;]+)/i);
      const fromMatch = ribbonTitle.match(/joined from\s*([^;]+)/i);

      return {
        date: dateMatch?.[1]?.trim() || null,
        fromTeam: fromMatch?.[1]?.trim() || null,
      };
    } catch {
      return { date: null, fromTeam: null };
    }
  };

  const parseRows = async (boxTitle: "Arrivals" | "Departures") => {
    const box = $("div.box").filter(
      (_, element) => $(element).find("h2").first().text().trim() === boxTitle
    );

    const rowElements = box
      .find("tbody tr.odd, tbody tr.even")
      .toArray();

    const parsedRows = rowElements.map((row, index) => {
      const cells = $(row).children("td");
      const playerCell = cells.eq(1);
      const previousOrNextClubCell = cells.eq(4);
      const feeCell = cells.eq(5);

      const playerLink = playerCell.find("td.hauptlink a").first();
      const playerName = playerLink.text().trim();
      const otherTeamName = previousOrNextClubCell
        .find("td.hauptlink a")
        .first()
        .text()
        .trim();
      const fee = feeCell.text().trim() || null;
      const transferDetailUrl = feeCell
        .find('a[href*="/jumplist/transfers/"]')
        .attr("href");

      if (!playerName) return null;

      return {
        index,
        playerName,
        otherTeamName,
        fee,
        transferDetailUrl: transferDetailUrl || "",
      };
    });

    const enrichedRows = await Promise.all(
      parsedRows.map(async (row) => {
        if (!row) return null;
        const meta = await fetchTransferMeta(row.transferDetailUrl);

        const playerName =
          row.playerName || (boxTitle === "Arrivals" ? "Unknown arrival" : "Unknown departure");
        const fromTeam =
          boxTitle === "Arrivals"
            ? row.otherTeamName || meta.fromTeam || "-"
            : teamName;
        const toTeam =
          boxTitle === "Arrivals"
            ? teamName
            : row.otherTeamName || "-";

        return {
          player: {
            id: teamId * 100000 + row.index,
            name: playerName,
          },
          update: null,
          date: meta.date,
          type: boxTitle === "Arrivals" ? "arrival" : "departure",
          fee: row.fee,
          teams:
            boxTitle === "Arrivals"
              ? {
                  in: { id: teamId, name: teamName, logo: null },
                  out: { name: fromTeam, logo: null },
                }
              : {
                  in: { name: toTeam, logo: null },
                  out: { id: teamId, name: teamName, logo: null },
                },
        };
      })
    );

    return enrichedRows.filter(Boolean);
  };

  const [arrivals, departures] = await Promise.all([
    parseRows("Arrivals"),
    parseRows("Departures"),
  ]);
  return [...arrivals, ...departures];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamName = searchParams.get("teamName");
  const league = searchParams.get("league");
  const seasonParam = Number(searchParams.get("season"));

  if (!teamName) {
    return NextResponse.json(
      { error: "Missing teamName parameter" },
      { status: 400 }
    );
  }

  const season = Number.isFinite(seasonParam)
    ? seasonParam
    : getLikelyCurrentSeasonStartYear();
  const leagueId =
    league && league in LEAGUES ? (league as LeagueId) : (null as LeagueId | null);

  try {
    const resolvedTeam =
      (await resolveTeamFromLeague(teamName, leagueId, season)) ||
      (await resolveTeamFromSearch(teamName));

    if (!resolvedTeam) {
      return NextResponse.json(
        {
          errorCode: 404,
          message: `No Transfermarkt team found for ${teamName}.`,
        },
        { status: 404 }
      );
    }

    let squad = await player.list(resolvedTeam.id, season.toString());
    if (!squad.length) {
      squad = await player.list(resolvedTeam.id, (season - 1).toString());
    }

    const transfers = await scrapeTransfers(resolvedTeam.id, season, resolvedTeam.name);

    return NextResponse.json({
      resolvedTeam,
      squad: squad.map((entry) => ({
        id: entry.id || 0,
        name: sanitizeText(entry.name) || "Unknown",
        age: computeAgeFromBirthDate(normalizeBirthDate(entry.birthday)),
        number: entry.number ?? null,
        position: sanitizeText(entry.position) || null,
        photo: entry.photoUrl ?? null,
        nationalities: (entry.nationalities || [])
          .map((value) => sanitizeText(value))
          .filter((value) => Boolean(value)),
        dateOfBirth: normalizeBirthDate(entry.birthday),
      })),
      transfers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scrape team extra data";
    console.error("Transfermarkt scrape error:", message);
    return NextResponse.json({ errorCode: 500, message }, { status: 500 });
  }
}
