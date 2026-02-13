"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import {
  getTeamExtraData,
  getLikelyCurrentSeasonStartYear,
  getTeamDetails,
  getTeamMatches,
  getTeamStandingRow,
} from "@/lib/api/football";
import {
  ApiFootballSquadPlayer,
  ApiFootballTransfer,
  Match,
  TablePosition,
  TeamDetailsResponse,
} from "@/lib/api/types";

type TeamTab =
  | "summary"
  | "results"
  | "fixtures"
  | "standings"
  | "transfers"
  | "squad";

const TABS: TeamTab[] = [
  "summary",
  "results",
  "fixtures",
  "standings",
  "transfers",
  "squad",
];

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface TeamContentProps {
  teamId: number;
  leagueId: LeagueId | null;
  activeTab: string;
}

function isValidTab(value: string): value is TeamTab {
  return TABS.includes(value as TeamTab);
}

function getTabLabel(tab: TeamTab): string {
  if (tab === "summary") return "Summary";
  if (tab === "results") return "Results";
  if (tab === "fixtures") return "Fixtures";
  if (tab === "standings") return "Standings";
  if (tab === "transfers") return "Transfers";
  return "Squad";
}

function resolveOpponent(match: Match, teamId: number) {
  return match.homeTeam.id === teamId ? match.awayTeam : match.homeTeam;
}

function resolveVenueLabel(match: Match, teamId: number) {
  return match.homeTeam.id === teamId ? "Home" : "Away";
}

function getResultTag(match: Match, teamId: number) {
  const home = match.score.fullTime.home;
  const away = match.score.fullTime.away;
  if (home === null || away === null) return "-";

  const goalDiff = match.homeTeam.id === teamId ? home - away : away - home;
  if (goalDiff > 0) return "W";
  if (goalDiff < 0) return "L";
  return "D";
}

function getResultTagClass(result: string) {
  if (result === "W") return "bg-emerald-500/20 text-emerald-300";
  if (result === "L") return "bg-red-500/20 text-red-300";
  if (result === "D") return "bg-zinc-700 text-zinc-200";
  return "bg-zinc-800 text-zinc-400";
}

function renderFormPills(form: string | null | undefined) {
  if (!form) {
    return <span className="text-lg font-semibold text-zinc-100">N/A</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {form.split(",").map((result, index) => {
        const value = result.trim().toUpperCase();
        return (
          <span
            key={`${value}-${index}`}
            className={`inline-flex h-7 min-w-7 items-center justify-center rounded px-2 text-sm font-semibold ${getResultTagClass(
              value
            )}`}
          >
            {value || "-"}
          </span>
        );
      })}
    </div>
  );
}

function getTransferTimestamp(transfer: ApiFootballTransfer): number {
  const dateCandidate = transfer.date || transfer.update;
  if (!dateCandidate) return 0;
  const timestamp = new Date(dateCandidate).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeTeamName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\b(fc|cf|sc|afc|ac)\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateOfBirth(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "-";
  }
  return parsed.toISOString().split("T")[0];
}

function getAgeFromBirthDate(value: string | null | undefined) {
  if (!value) return null;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasBirthdayPassedThisYear =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasBirthdayPassedThisYear) age -= 1;
  return age >= 0 ? age : null;
}

function TeamMatchesTable({
  matches,
  teamId,
  showScore,
  leagueId,
}: {
  matches: Match[];
  teamId: number;
  showScore: boolean;
  leagueId: LeagueId | null;
}) {
  if (matches.length === 0) {
    return <div className="p-4 text-zinc-400">No matches available.</div>;
  }

  return (
    <div>
      <div className="space-y-2 p-2 md:hidden">
        {matches.map((match) => {
          const opponent = resolveOpponent(match, teamId);
          const result = getResultTag(match, teamId);
          return (
            <div
              key={match.id}
              className="rounded-md border border-zinc-800 bg-zinc-900/70 p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-zinc-400">
                  {dateFormatter.format(new Date(match.utcDate))}
                </div>
                <span className="text-xs text-zinc-400">{resolveVenueLabel(match, teamId)}</span>
              </div>
              <Link
                href={`/team/${opponent.id}${leagueId ? `?league=${leagueId}` : ""}`}
                className="mt-1 inline-flex items-center gap-2 font-medium text-zinc-100 hover:underline"
              >
                {opponent.crest ? (
                  <span className="relative h-5 w-5">
                    <Image
                      src={opponent.crest}
                      alt={opponent.name}
                      fill
                      sizes="20px"
                      className="object-contain"
                    />
                  </span>
                ) : null}
                <span>{opponent.shortName || opponent.name}</span>
              </Link>
              <div className="mt-2 flex items-center justify-between">
                {showScore ? (
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-2 text-xs font-semibold ${getResultTagClass(
                      result
                    )}`}
                  >
                    {result}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400">{match.status}</span>
                )}
                <span className="text-sm font-semibold text-zinc-100">
                  {showScore
                    ? `${match.score.fullTime.home ?? "-"}-${match.score.fullTime.away ?? "-"}`
                    : new Date(match.utcDate).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[720px]">
        <thead>
          <tr className="bg-zinc-900 text-left text-zinc-300">
            <th className="p-2.5 w-36">Date</th>
            <th className="p-2.5 w-20">Venue</th>
            <th className="p-2.5">Opponent</th>
            <th className="p-2.5 w-20 text-center">Status</th>
            <th className="p-2.5 w-20 text-center">{showScore ? "Score" : "Kickoff"}</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const opponent = resolveOpponent(match, teamId);
            const result = getResultTag(match, teamId);

            return (
              <tr
                key={match.id}
                className="border-t border-zinc-800 text-zinc-200 hover:bg-zinc-800/60"
              >
                <td className="p-2.5">{dateFormatter.format(new Date(match.utcDate))}</td>
                <td className="p-2.5">{resolveVenueLabel(match, teamId)}</td>
                <td className="p-2.5">
                  <Link
                    href={`/team/${opponent.id}${
                      leagueId ? `?league=${leagueId}` : ""
                    }`}
                    className="inline-flex items-center gap-2 font-medium hover:underline"
                  >
                    {opponent.crest ? (
                      <span className="relative w-5 h-5">
                        <Image
                          src={opponent.crest}
                          alt={opponent.name}
                          fill
                          sizes="20px"
                          className="object-contain"
                        />
                      </span>
                    ) : null}
                    <span>{opponent.shortName || opponent.name}</span>
                  </Link>
                </td>
                <td className="p-2.5 text-center">
                  {showScore ? (
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-2 text-xs font-semibold ${getResultTagClass(
                        result
                      )}`}
                    >
                      {result}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">{match.status}</span>
                  )}
                </td>
                <td className="p-2.5 text-center font-medium">
                  {showScore
                    ? `${match.score.fullTime.home ?? "-"}-${match.score.fullTime.away ?? "-"}`
                    : new Date(match.utcDate).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function StandingsTable({
  table,
  teamId,
  leagueId,
}: {
  table: TablePosition[];
  teamId: number;
  leagueId: LeagueId | null;
}) {
  if (table.length === 0) {
    return <div className="p-4 text-zinc-400">No standings data available.</div>;
  }

  return (
    <div>
      <div className="space-y-2 p-2 md:hidden">
        {table.map((row) => (
          <div
            key={row.team.id}
            className={`rounded-md border p-2 ${
              row.team.id === teamId
                ? "border-zinc-600 bg-zinc-800/90"
                : "border-zinc-800 bg-zinc-900/70"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/team/${row.team.id}${leagueId ? `?league=${leagueId}` : ""}`}
                className="inline-flex min-w-0 items-center gap-2 hover:underline"
              >
                <span className="w-4 text-xs font-semibold text-zinc-400">{row.position}</span>
                {row.team.crest ? (
                  <span className="relative h-5 w-5 flex-shrink-0">
                    <Image
                      src={row.team.crest}
                      alt={row.team.name}
                      fill
                      sizes="20px"
                      className="object-contain"
                    />
                  </span>
                ) : null}
                <span className="truncate font-medium text-zinc-100">
                  {row.team.shortName || row.team.name}
                </span>
              </Link>
              <span className="text-sm font-semibold text-zinc-100">{row.points} pts</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-300">
              <span>P {row.playedGames}</span>
              <span>W {row.won}</span>
              <span>D {row.draw}</span>
              <span>L {row.lost}</span>
              <span>GD {row.goalDifference}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr className="bg-zinc-900 text-left text-zinc-300">
            <th className="p-2.5 w-10">#</th>
            <th className="p-2.5">Team</th>
            <th className="p-2.5 w-12 text-center">P</th>
            <th className="p-2.5 w-12 text-center">W</th>
            <th className="p-2.5 w-12 text-center">D</th>
            <th className="p-2.5 w-12 text-center">L</th>
            <th className="p-2.5 w-14 text-center">GD</th>
            <th className="p-2.5 w-14 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row) => (
            <tr
              key={row.team.id}
              className={`border-t border-zinc-800 text-zinc-200 ${
                row.team.id === teamId ? "bg-zinc-800/90" : "hover:bg-zinc-800/60"
              }`}
            >
              <td className="p-2.5">{row.position}</td>
              <td className="p-2.5">
                <Link
                  href={`/team/${row.team.id}${leagueId ? `?league=${leagueId}` : ""}`}
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  {row.team.crest ? (
                    <span className="relative w-5 h-5">
                      <Image
                        src={row.team.crest}
                        alt={row.team.name}
                        fill
                        sizes="20px"
                        className="object-contain"
                      />
                    </span>
                  ) : null}
                  <span className="font-medium">{row.team.shortName || row.team.name}</span>
                </Link>
              </td>
              <td className="p-2.5 text-center">{row.playedGames}</td>
              <td className="p-2.5 text-center">{row.won}</td>
              <td className="p-2.5 text-center">{row.draw}</td>
              <td className="p-2.5 text-center">{row.lost}</td>
              <td className="p-2.5 text-center">{row.goalDifference}</td>
              <td className="p-2.5 text-center font-semibold">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default function TeamContent({
  teamId,
  leagueId,
  activeTab,
}: TeamContentProps) {
  const seasonStartYear = getLikelyCurrentSeasonStartYear();
  const [team, setTeam] = useState<TeamDetailsResponse | null>(null);
  const [results, setResults] = useState<Match[]>([]);
  const [fixtures, setFixtures] = useState<Match[]>([]);
  const [table, setTable] = useState<TablePosition[]>([]);
  const [teamRow, setTeamRow] = useState<TablePosition | null>(null);
  const [transferRows, setTransferRows] = useState<ApiFootballTransfer[]>([]);
  const [squadRows, setSquadRows] = useState<ApiFootballSquadPlayer[]>([]);
  const [teamExtraError, setTeamExtraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadTeamSection() {
      try {
        if (isActive) {
          setIsLoading(true);
          setError(null);
          setTeamExtraError(null);
        }

        const todayDate = new Date();
        const today = todayDate.toISOString().split("T")[0];
        const fixturesToDate = new Date(todayDate);
        fixturesToDate.setDate(fixturesToDate.getDate() + 60);
        const dateTo = fixturesToDate.toISOString().split("T")[0];
        const [teamResult, resultsResult, fixturesResult, standingsResult] =
          await Promise.allSettled([
            getTeamDetails(teamId, leagueId || undefined),
            getTeamMatches(teamId, {
              status: "FINISHED",
              limit: 10,
              leagueId: leagueId || undefined,
            }),
            getTeamMatches(teamId, {
              dateFrom: today,
              dateTo,
              limit: 10,
              leagueId: leagueId || undefined,
            }),
            leagueId
              ? getTeamStandingRow(leagueId, teamId, seasonStartYear)
              : Promise.resolve({ teamRow: null, table: [] }),
          ]);

        if (!isActive) return;

        if (teamResult.status === "fulfilled") {
          setTeam(teamResult.value);
          try {
            const teamExtraData = await getTeamExtraData(
              teamResult.value.name,
              teamResult.value.area?.name || undefined,
              leagueId || undefined,
              seasonStartYear
            );
            if (!isActive) return;

            setSquadRows(teamExtraData.squad || []);
            setTransferRows(
              [...(teamExtraData.transfers || [])].sort(
                (a, b) => getTransferTimestamp(b) - getTransferTimestamp(a)
              )
            );
            setTeamExtraError(null);
          } catch (teamExtraErr) {
            if (!isActive) return;
            const extraError = teamExtraErr as Error;
            setSquadRows([]);
            setTransferRows([]);
            setTeamExtraError(
              extraError.message || "Could not load transfer and player data."
            );
          }
        } else {
          setTeam(null);
          setSquadRows([]);
          setTransferRows([]);
          setTeamExtraError(null);
          setError("Could not load team details.");
        }

        if (resultsResult.status === "fulfilled") {
          const sorted = [...(resultsResult.value.matches || [])]
            .filter((match) => match.status === "FINISHED")
            .sort(
              (a, b) =>
                new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
            );
          setResults(sorted);
        } else {
          setResults([]);
        }

        if (fixturesResult.status === "fulfilled") {
          const sorted = [...(fixturesResult.value.matches || [])]
            .filter((match) => match.status !== "FINISHED")
            .sort(
              (a, b) =>
                new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
            );
          setFixtures(sorted);
        } else {
          setFixtures([]);
        }

        if (standingsResult.status === "fulfilled") {
          setTeamRow(standingsResult.value.teamRow);
          setTable(standingsResult.value.table);
        } else {
          setTeamRow(null);
          setTable([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadTeamSection();
    return () => {
      isActive = false;
    };
  }, [teamId, leagueId, reloadKey, seasonStartYear]);

  const tabBaseQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (leagueId) {
      params.set("league", leagueId);
    }
    return params;
  }, [leagueId]);

  const knownTeamIdByName = useMemo(() => {
    const map = new Map<string, number>();
    const register = (name: string | undefined | null, id: number | undefined | null) => {
      if (!name || !id) return;
      map.set(normalizeTeamName(name), id);
    };

    register(team?.name, teamId);
    table.forEach((row) => register(row.team.name, row.team.id));
    fixtures.forEach((match) => {
      register(match.homeTeam.name, match.homeTeam.id);
      register(match.awayTeam.name, match.awayTeam.id);
    });
    results.forEach((match) => {
      register(match.homeTeam.name, match.homeTeam.id);
      register(match.awayTeam.name, match.awayTeam.id);
    });

    return map;
  }, [fixtures, results, table, team?.name, teamId]);

  const renderTransferTeamCell = (teamName: string | undefined | null) => {
    if (!teamName) return "-";
    const knownId = knownTeamIdByName.get(normalizeTeamName(teamName));
    if (!knownId) return teamName;
    return (
      <Link
        href={`/team/${knownId}${leagueId ? `?league=${leagueId}` : ""}`}
        className="hover:underline"
      >
        {teamName}
      </Link>
    );
  };

  const derivedRecentForm = useMemo(() => {
    const recentFinished = results
      .filter((match) => match.status === "FINISHED")
      .slice(0, 5);
    if (recentFinished.length === 0) return null;
    return recentFinished.map((match) => getResultTag(match, teamId)).join(",");
  }, [results, teamId]);

  const mergedSquadRows = useMemo(() => {
    const fallbackByName = new Map<
      string,
      {
        id: number;
        name: string;
        shirtNumber?: number | null;
        position?: string | null;
        nationality?: string | null;
        dateOfBirth?: string | null;
      }
    >();
    (team?.squad || []).forEach((entry) => {
      fallbackByName.set(normalizeTeamName(entry.name || ""), entry);
    });

    if (squadRows.length > 0) {
      return squadRows.map((entry) => {
        const fallback = fallbackByName.get(normalizeTeamName(entry.name || ""));
        const dateOfBirth = entry.dateOfBirth || fallback?.dateOfBirth || null;
        const age = entry.age ?? getAgeFromBirthDate(dateOfBirth);
        const nationality =
          entry.nationalities?.length
            ? entry.nationalities
            : fallback?.nationality
              ? [fallback.nationality]
              : [];

        return {
          id: entry.id || fallback?.id || 0,
          name: entry.name || fallback?.name || "Unknown",
          photo: entry.photo || null,
          age,
          position: entry.position || fallback?.position || null,
          number: entry.number ?? fallback?.shirtNumber ?? null,
          nationality,
          dateOfBirth,
        };
      });
    }

    return (team?.squad || []).map((entry) => ({
      id: entry.id || 0,
      name: entry.name || "Unknown",
      photo: null,
      age: getAgeFromBirthDate(entry.dateOfBirth || null),
      position: entry.position || null,
      number: entry.shirtNumber ?? null,
      nationality: entry.nationality ? [entry.nationality] : [],
      dateOfBirth: entry.dateOfBirth || null,
    }));
  }, [squadRows, team?.squad]);

  const content = (() => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-20 bg-zinc-800" />
          <Skeleton className="h-20 bg-zinc-800" />
          <Skeleton className="h-20 bg-zinc-800" />
        </div>
      );
    }

    if (error || !team) {
      return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="mb-2 font-semibold text-red-300">Data Unavailable</p>
          <p className="mb-3 text-zinc-200">{error || "Could not load this team."}</p>
          <Button onClick={() => setReloadKey((value) => value + 1)} variant="outline">
            Retry
          </Button>
        </div>
      );
    }

    if (!isValidTab(activeTab)) {
      return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-200">
          Invalid tab.
        </div>
      );
    }

    if (activeTab === "summary") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-zinc-500">Country</p>
              <p className="font-medium text-zinc-100">{team.area?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Stadium</p>
              <p className="font-medium text-zinc-100">{team.venue || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Founded</p>
              <p className="font-medium text-zinc-100">{team.founded || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Club Colors</p>
              <p className="font-medium text-zinc-100">{team.clubColors || "N/A"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs uppercase text-zinc-500">Website</p>
              {team.website ? (
                <a
                  href={team.website}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-medium text-blue-400 hover:underline"
                >
                  {team.website}
                </a>
              ) : (
                <p className="font-medium text-zinc-100">N/A</p>
              )}
            </div>
          </div>

          {leagueId && teamRow ? (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 md:grid-cols-5">
              <div>
                <p className="text-xs uppercase text-zinc-500">Position</p>
                <p className="text-lg font-semibold text-zinc-100">{teamRow.position}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-zinc-500">Played</p>
                <p className="text-lg font-semibold text-zinc-100">{teamRow.playedGames}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-zinc-500">Points</p>
                <p className="text-lg font-semibold text-zinc-100">{teamRow.points}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-zinc-500">Goal Diff</p>
                <p className="text-lg font-semibold text-zinc-100">{teamRow.goalDifference}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-zinc-500">Form</p>
                {renderFormPills(teamRow.form || derivedRecentForm)}
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-zinc-800 p-3 font-semibold text-zinc-100">
              Latest Results
            </div>
            <TeamMatchesTable
              matches={results.slice(0, 5)}
              teamId={teamId}
              showScore
              leagueId={leagueId}
            />
          </div>
        </div>
      );
    }

    if (activeTab === "results") {
      return (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
          <TeamMatchesTable
            matches={results}
            teamId={teamId}
            showScore
            leagueId={leagueId}
          />
        </div>
      );
    }

    if (activeTab === "fixtures") {
      return (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
          <TeamMatchesTable
            matches={fixtures}
            teamId={teamId}
            showScore={false}
            leagueId={leagueId}
          />
        </div>
      );
    }

    if (activeTab === "standings") {
      if (!leagueId) {
        return (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-300">
            Open this team from a league fixture/table row to load league standings.
          </div>
        );
      }

      return (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
          <StandingsTable table={table} teamId={teamId} leagueId={leagueId} />
        </div>
      );
    }

    if (activeTab === "transfers") {
      if (teamExtraError) {
        return (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-300">
            <p className="mb-2 font-semibold text-red-300">Transfers unavailable</p>
            <p>{teamExtraError}</p>
          </div>
        );
      }

      return (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
          {transferRows.length === 0 ? (
            <div className="p-4 text-zinc-400">No transfer data available for this team.</div>
          ) : (
            <>
              <div className="space-y-2 p-2 md:hidden">
                {transferRows.map((transfer, index) => (
                  <div
                    key={`${transfer.player.id}-${transfer.date || transfer.update || "na"}-${
                      transfer.type || "na"
                    }-${transfer.teams.out?.name || "na"}-${transfer.teams.in?.name || "na"}-${index}`}
                    className="rounded-md border border-zinc-800 bg-zinc-900/70 p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/player/${transfer.player.id}?league=${leagueId || ""}&name=${encodeURIComponent(
                          transfer.player.name
                        )}&teamId=${teamId}&teamName=${encodeURIComponent(team?.name || "")}`}
                        className="truncate text-sm font-medium text-zinc-100 hover:underline"
                      >
                        {transfer.player.name}
                      </Link>
                      <span className="text-xs text-zinc-400">
                        {transfer.date || transfer.update || "-"}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-zinc-500">From</p>
                        <div className="text-zinc-300">
                          {renderTransferTeamCell(transfer.teams.out?.name)}
                        </div>
                      </div>
                      <div>
                        <p className="text-zinc-500">To</p>
                        <div className="text-zinc-300">
                          {renderTransferTeamCell(transfer.teams.in?.name)}
                        </div>
                      </div>
                      <div>
                        <p className="text-zinc-500">Fee</p>
                        <p className="text-zinc-300">{transfer.fee || "-"}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Type</p>
                        <p className="text-zinc-300">{transfer.type || "-"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="bg-zinc-900 text-left text-zinc-300">
                    <th className="p-2.5 w-36">Date</th>
                    <th className="p-2.5">Player</th>
                    <th className="p-2.5">From</th>
                    <th className="p-2.5">To</th>
                    <th className="p-2.5 w-28">Fee</th>
                    <th className="p-2.5 w-28">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {transferRows.map((transfer, index) => (
                    <tr
                      key={`${transfer.player.id}-${transfer.date || transfer.update || "na"}-${
                        transfer.type || "na"
                      }-${transfer.teams.out?.name || "na"}-${transfer.teams.in?.name || "na"}-${index}`}
                      className="border-t border-zinc-800 text-zinc-200 hover:bg-zinc-800/60"
                    >
                      <td className="p-2.5">{transfer.date || transfer.update || "-"}</td>
                      <td className="p-2.5 font-medium">
                        <Link
                          href={`/player/${transfer.player.id}?league=${leagueId || ""}&name=${encodeURIComponent(
                            transfer.player.name
                          )}&teamId=${teamId}&teamName=${encodeURIComponent(team?.name || "")}`}
                          className="hover:underline"
                        >
                          {transfer.player.name}
                        </Link>
                      </td>
                      <td className="p-2.5">{renderTransferTeamCell(transfer.teams.out?.name)}</td>
                      <td className="p-2.5">{renderTransferTeamCell(transfer.teams.in?.name)}</td>
                      <td className="p-2.5">{transfer.fee || "-"}</td>
                      <td className="p-2.5">{transfer.type || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
        {mergedSquadRows.length === 0 ? (
          <div className="p-4 text-zinc-400">
            {teamExtraError
              ? `No squad data available. ${teamExtraError}`
              : "No squad data available for this team."}
          </div>
        ) : (
          <>
            <div className="space-y-2 p-2 md:hidden">
              {mergedSquadRows.map((player) => (
                <div
                  key={`${player.id}-${player.name}`}
                  className="rounded-md border border-zinc-800 bg-zinc-900/70 p-2"
                >
                  <Link
                    href={`/player/${player.id}?league=${leagueId || ""}&name=${encodeURIComponent(
                      player.name
                    )}&teamId=${teamId}&teamName=${encodeURIComponent(team?.name || "")}`}
                    className="inline-flex items-center gap-2 hover:underline"
                  >
                    {player.photo ? (
                      <span className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded border border-zinc-700 bg-zinc-900">
                        <Image
                          src={player.photo}
                          alt={player.name}
                          fill
                          sizes="32px"
                          className="object-cover"
                        />
                      </span>
                    ) : null}
                    <span className="text-sm font-medium text-zinc-100">{player.name}</span>
                  </Link>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-300">
                    <span>Age: {player.age ?? "-"}</span>
                    <span>No.: {player.number ?? "-"}</span>
                    <span className="col-span-2">Position: {player.position || "-"}</span>
                    <span className="col-span-2">
                      Nationality: {player.nationality.length ? player.nationality.join(", ") : "-"}
                    </span>
                    <span className="col-span-2">
                      DOB: {formatDateOfBirth(player.dateOfBirth)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px]">
                <thead>
                <tr className="bg-zinc-900 text-left text-zinc-300">
                  <th className="p-2.5">Player</th>
                  <th className="p-2.5 w-20 text-center">Age</th>
                  <th className="p-2.5 w-40">Position</th>
                  <th className="p-2.5 w-16 text-center">No.</th>
                  <th className="p-2.5 w-40">Nationality</th>
                  <th className="p-2.5 w-44">Date of birth</th>
                </tr>
              </thead>
              <tbody>
                {mergedSquadRows.map((player) => (
                  <tr
                    key={`${player.id}-${player.name}`}
                    className="border-t border-zinc-800 text-zinc-200 hover:bg-zinc-800/60"
                  >
                    <td className="p-2.5 font-medium">
                      <Link
                        href={`/player/${player.id}?league=${leagueId || ""}&name=${encodeURIComponent(
                          player.name
                        )}&teamId=${teamId}&teamName=${encodeURIComponent(team?.name || "")}`}
                        className="inline-flex items-center gap-2 hover:underline"
                      >
                        {player.photo ? (
                          <span className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded border border-zinc-700 bg-zinc-900">
                            <Image
                              src={player.photo}
                              alt={player.name}
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          </span>
                        ) : null}
                        <span>{player.name}</span>
                      </Link>
                    </td>
                    <td className="p-2.5 text-center">{player.age ?? "-"}</td>
                    <td className="p-2.5">{player.position || "-"}</td>
                    <td className="p-2.5 text-center">{player.number ?? "-"}</td>
                    <td className="p-2.5">
                      {player.nationality.length ? player.nationality.join(", ") : "-"}
                    </td>
                    <td className="p-2.5">{formatDateOfBirth(player.dateOfBirth)}</td>
                  </tr>
                ))}
              </tbody>
             </table>
            </div>
          </>
        )}
      </div>
    );
  })();

  return (
    <main className="flex flex-1 flex-col rounded-xl border border-zinc-800 bg-[#0b111b]">
      <div className="px-2 py-3 sm:px-4 sm:py-5 flex flex-col h-full">
        <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-zinc-100 sm:text-2xl">
                {team?.name || `Team #${teamId}`}
              </h1>
              <p className="text-sm text-zinc-400">
                {leagueId ? LEAGUES[leagueId].name : "All Competitions"} • Season{" "}
                {seasonStartYear}/{(seasonStartYear + 1).toString().slice(2)}
              </p>
            </div>
            {team?.crest ? (
              <div className="relative h-14 w-14 flex-shrink-0 sm:h-16 sm:w-16">
                <Image
                  src={team.crest}
                  alt={team.name}
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
            {TABS.map((tab) => {
              const params = new URLSearchParams(tabBaseQuery.toString());
              params.set("tab", tab);

              return (
                <Link
                  key={tab}
                  href={`/team/${teamId}?${params.toString()}`}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-zinc-100 text-zinc-950"
                      : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  }`}
                >
                  {getTabLabel(tab)}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex-1 rounded-lg p-2 sm:p-4 lg:max-h-[calc(100dvh-250px)] lg:overflow-y-auto">
          {content}
        </div>
      </div>
    </main>
  );
}
