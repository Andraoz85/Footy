"use client";

import { useEffect, useMemo, useState } from "react";
import { CompetitionTeamsResponse, ScorerEntry } from "@/lib/api/types";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import {
  getCompetitionTeams,
  getLikelyCurrentSeasonStartYear,
  getTopScorers,
} from "@/lib/api/football";
import { useLeague } from "@/lib/context/LeagueContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StatsTab = "scorers" | "squads";
type LeaderboardMode = "goals" | "assists";
type SortField = "rankMetric" | "goals" | "assists" | "penalties" | "player" | "team";
type SortDirection = "asc" | "desc";

const SEASON_START = getLikelyCurrentSeasonStartYear();

function getAge(dateOfBirth?: string | null): string {
  if (!dateOfBirth) return "N/A";
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return "N/A";

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasBirthdayPassedThisYear =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasBirthdayPassedThisYear) {
    age -= 1;
  }
  return age.toString();
}

export default function StatsContent() {
  const { selectedLeague } = useLeague();
  const leagueToShow = (selectedLeague || "PL") as LeagueId;

  const [activeTab, setActiveTab] = useState<StatsTab>("scorers");
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>("goals");
  const [scorers, setScorers] = useState<ScorerEntry[]>([]);
  const [teamsResponse, setTeamsResponse] =
    useState<CompetitionTeamsResponse | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedPlayerProfile, setSelectedPlayerProfile] =
    useState<ScorerEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("rankMetric");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function fetchStats() {
      try {
        if (isActive) {
          setIsLoading(true);
          setError(null);
        }

        const [scorersResult, teamsResult] = await Promise.allSettled([
          getTopScorers(leagueToShow, 30, SEASON_START),
          getCompetitionTeams(leagueToShow),
        ]);

        if (!isActive) return;

        if (scorersResult.status === "fulfilled") {
          setScorers(scorersResult.value.scorers || []);
        } else {
          setScorers([]);
        }

        if (teamsResult.status === "fulfilled") {
          const data = teamsResult.value;
          setTeamsResponse(data);
          if (data.teams?.length > 0) {
            setSelectedTeamId((prev) =>
              prev && data.teams.some((team) => team.id === prev)
                ? prev
                : data.teams[0].id
            );
          } else {
            setSelectedTeamId(null);
          }
        } else {
          setTeamsResponse(null);
          setSelectedTeamId(null);
        }

        if (
          scorersResult.status === "rejected" &&
          teamsResult.status === "rejected"
        ) {
          setError("Could not load statistics. Please try again later.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchStats();

    return () => {
      isActive = false;
    };
  }, [leagueToShow, reloadKey]);

  const selectedTeam = useMemo(
    () => teamsResponse?.teams.find((team) => team.id === selectedTeamId) || null,
    [teamsResponse, selectedTeamId]
  );

  const filteredAndSortedScorers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const metricAccessor = (entry: ScorerEntry) =>
      leaderboardMode === "assists" ? (entry.assists ?? 0) : entry.goals;

    const filtered = scorers.filter((entry) => {
      const matchesQuery =
        query.length === 0 ||
        entry.player.name.toLowerCase().includes(query) ||
        entry.team.name.toLowerCase().includes(query) ||
        entry.team.shortName.toLowerCase().includes(query);

      const matchesTeam =
        teamFilter === "all" || entry.team.id.toString() === teamFilter;

      const hasMetric = leaderboardMode === "goals" || (entry.assists ?? 0) > 0;

      return matchesQuery && matchesTeam && hasMetric;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aMetric = metricAccessor(a);
      const bMetric = metricAccessor(b);

      let value = 0;
      if (sortField === "rankMetric") {
        value = aMetric - bMetric;
      } else if (sortField === "goals") {
        value = a.goals - b.goals;
      } else if (sortField === "assists") {
        value = (a.assists ?? 0) - (b.assists ?? 0);
      } else if (sortField === "penalties") {
        value = (a.penalties ?? 0) - (b.penalties ?? 0);
      } else if (sortField === "player") {
        value = a.player.name.localeCompare(b.player.name);
      } else if (sortField === "team") {
        value = (a.team.shortName || a.team.name).localeCompare(
          b.team.shortName || b.team.name
        );
      }

      return sortDirection === "asc" ? value : -value;
    });

    return sorted;
  }, [leaderboardMode, scorers, searchQuery, sortDirection, sortField, teamFilter]);

  return (
    <main className="flex-1 bg-green-800 shadow rounded-lg flex flex-col">
      <div className="px-2 py-3 sm:px-4 sm:py-5 flex flex-col h-full">
        <h2 className="text-lg sm:text-xl font-semibold text-white mb-1">
          {selectedLeague ? LEAGUES[selectedLeague].name : "Premier League"} Stats
        </h2>
        <p className="text-xs sm:text-sm text-green-100 mb-3">
          Season {SEASON_START}/{(SEASON_START + 1).toString().slice(2)}
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeTab === "scorers" ? "default" : "secondary"}
            onClick={() => setActiveTab("scorers")}
          >
            Leaderboards
          </Button>
          <Button
            type="button"
            variant={activeTab === "squads" ? "default" : "secondary"}
            onClick={() => setActiveTab("squads")}
          >
            Squads
          </Button>
        </div>

        <div className="flex-1 rounded-lg p-2 sm:p-4 lg:max-h-[calc(100dvh-250px)] lg:overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 bg-white/25" />
              <Skeleton className="h-16 bg-white/25" />
              <Skeleton className="h-16 bg-white/25" />
              <Skeleton className="h-16 bg-white/25" />
            </div>
          ) : null}

          {!isLoading && error ? (
            <div className="bg-white/80 p-4 rounded-lg text-gray-800">
              <p className="text-red-600 font-semibold mb-2">Data Unavailable</p>
              <p className="mb-3">{error}</p>
              <Button
                onClick={() => setReloadKey((value) => value + 1)}
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : null}

          {!isLoading && !error && activeTab === "scorers" ? (
            <div className="space-y-3">
              <div className="bg-white/85 rounded-lg p-3 grid grid-cols-1 lg:grid-cols-5 gap-2">
                <Input
                  type="search"
                  placeholder="Filter by player or team"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="lg:col-span-2"
                />
                <select
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                >
                  <option value="all">All teams</option>
                  {Array.from(
                    new Map(
                      scorers.map((entry) => [entry.team.id, entry.team])
                    ).values()
                  )
                    .sort((a, b) => (a.shortName || a.name).localeCompare(b.shortName || b.name))
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.shortName || team.name}
                      </option>
                    ))}
                </select>
                <select
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                  value={sortField}
                  onChange={(event) => setSortField(event.target.value as SortField)}
                >
                  <option value="rankMetric">
                    Sort by {leaderboardMode === "assists" ? "assists" : "goals"}
                  </option>
                  <option value="goals">Sort by goals</option>
                  <option value="assists">Sort by assists</option>
                  <option value="penalties">Sort by penalties</option>
                  <option value="player">Sort by player</option>
                  <option value="team">Sort by team</option>
                </select>
                <select
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                  value={sortDirection}
                  onChange={(event) =>
                    setSortDirection(event.target.value as SortDirection)
                  }
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={leaderboardMode === "goals" ? "default" : "secondary"}
                  onClick={() => setLeaderboardMode("goals")}
                >
                  Top Scorers
                </Button>
                <Button
                  type="button"
                  variant={leaderboardMode === "assists" ? "default" : "secondary"}
                  onClick={() => setLeaderboardMode("assists")}
                >
                  Top Assists
                </Button>
              </div>

              <div className="bg-white/85 rounded-lg overflow-hidden">
                {filteredAndSortedScorers.length === 0 ? (
                  <div className="p-4 text-gray-700">
                    No {leaderboardMode} data available with current filters.
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 p-2 md:hidden">
                      {filteredAndSortedScorers.map((entry, index) => (
                        <div
                          key={`${entry.player.id}-${entry.team.id}`}
                          className="rounded-md border border-gray-200 bg-white p-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              className="min-w-0 text-left"
                              onClick={() => setSelectedPlayerProfile(entry)}
                            >
                              <div className="text-xs text-gray-500">#{index + 1}</div>
                              <div className="truncate text-sm font-semibold text-gray-900">
                                {entry.player.name}
                              </div>
                            </button>
                            <div className="text-right">
                              <div className="text-[11px] uppercase text-gray-500">
                                {leaderboardMode === "assists" ? "Assists" : "Goals"}
                              </div>
                              <div className="text-sm font-semibold text-gray-900">
                                {leaderboardMode === "assists" ? entry.assists ?? 0 : entry.goals}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-700">
                            <Link
                              href={`/team/${entry.team.id}?league=${leagueToShow}`}
                              className="inline-flex min-w-0 items-center gap-1 hover:underline"
                            >
                              {entry.team.crest ? (
                                <div className="relative h-4 w-4">
                                  <Image
                                    src={entry.team.crest}
                                    alt={entry.team.name}
                                    fill
                                    sizes="16px"
                                    className="object-contain"
                                  />
                                </div>
                              ) : null}
                              <span className="truncate">{entry.team.shortName || entry.team.name}</span>
                            </Link>
                            <span>
                              G {entry.goals} | A {entry.assists ?? "-"} | P {entry.penalties ?? "-"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[780px]">
                      <thead>
                        <tr className="bg-gray-100 text-left">
                          <th className="p-2.5 w-10">#</th>
                          <th className="p-2.5">Player</th>
                          <th className="p-2.5">Team</th>
                          <th className="p-2.5 text-center w-28">
                            {leaderboardMode === "assists" ? "Assists" : "Goals"}
                          </th>
                          <th className="p-2.5 text-center w-24">Goals</th>
                          <th className="p-2.5 text-center w-24">Assists</th>
                          <th className="p-2.5 text-center w-24">Pens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedScorers.map((entry, index) => (
                          <tr
                            key={`${entry.player.id}-${entry.team.id}`}
                            className="border-t border-gray-200 hover:bg-gray-50"
                          >
                            <td className="p-2.5">{index + 1}</td>
                            <td className="p-2.5 font-medium">
                              <button
                                type="button"
                                className="text-left underline-offset-2 hover:underline"
                                onClick={() => setSelectedPlayerProfile(entry)}
                              >
                                {entry.player.name}
                              </button>
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center gap-2">
                                {entry.team.crest ? (
                                  <div className="relative w-5 h-5">
                                    <Image
                                      src={entry.team.crest}
                                      alt={entry.team.name}
                                      fill
                                      sizes="20px"
                                      className="object-contain"
                                    />
                                  </div>
                                ) : null}
                                <Link
                                  href={`/team/${entry.team.id}?league=${leagueToShow}`}
                                  className="hover:underline"
                                >
                                  {entry.team.shortName || entry.team.name}
                                </Link>
                              </div>
                            </td>
                            <td className="p-2.5 text-center font-semibold">
                              {leaderboardMode === "assists"
                                ? entry.assists ?? 0
                                : entry.goals}
                            </td>
                            <td className="p-2.5 text-center">{entry.goals}</td>
                            <td className="p-2.5 text-center">{entry.assists ?? "-"}</td>
                            <td className="p-2.5 text-center">{entry.penalties ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {!isLoading && !error && activeTab === "squads" ? (
            <div className="space-y-3">
              <div className="bg-white/85 rounded-lg p-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                  value={selectedTeamId ?? ""}
                  onChange={(event) =>
                    setSelectedTeamId(Number(event.target.value) || null)
                  }
                >
                  {(teamsResponse?.teams || []).map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white/85 rounded-lg overflow-hidden">
                {!selectedTeam ? (
                  <div className="p-4 text-gray-700">
                    No team data available for this league.
                  </div>
                ) : selectedTeam.squad && selectedTeam.squad.length > 0 ? (
                  <>
                    <div className="space-y-2 p-2 md:hidden">
                      {selectedTeam.squad.map((player) => (
                        <div
                          key={player.id}
                          className="rounded-md border border-gray-200 bg-white p-2"
                        >
                          <div className="text-sm font-semibold text-gray-900">{player.name}</div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700">
                            <span>Position: {player.position || "-"}</span>
                            <span>No.: {player.shirtNumber ?? "-"}</span>
                            <span className="col-span-2">Nationality: {player.nationality || "-"}</span>
                            <span className="col-span-2">DOB: {player.dateOfBirth || "-"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[780px]">
                      <thead>
                        <tr className="bg-gray-100 text-left">
                          <th className="p-2.5">Player</th>
                          <th className="p-2.5 w-32">Position</th>
                          <th className="p-2.5 w-14 text-center">No.</th>
                          <th className="p-2.5 w-40">Nationality</th>
                          <th className="p-2.5 w-40">Date of birth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTeam.squad.map((player) => (
                          <tr
                            key={player.id}
                            className="border-t border-gray-200 hover:bg-gray-50"
                          >
                            <td className="p-2.5 font-medium">{player.name}</td>
                            <td className="p-2.5">{player.position || "-"}</td>
                            <td className="p-2.5 text-center">
                              {player.shirtNumber ?? "-"}
                            </td>
                            <td className="p-2.5">{player.nationality || "-"}</td>
                            <td className="p-2.5">{player.dateOfBirth || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-gray-700">
                    Squad details are not available for this team in your API tier.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog
        open={selectedPlayerProfile !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPlayerProfile(null);
        }}
      >
        <DialogContent>
          {selectedPlayerProfile ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPlayerProfile.player.name}</DialogTitle>
                <DialogDescription>
                  {selectedPlayerProfile.team.name} • Season {SEASON_START}/
                  {(SEASON_START + 1).toString().slice(2)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Position</p>
                  <p className="font-medium">
                    {selectedPlayerProfile.player.position || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Age</p>
                  <p className="font-medium">
                    {getAge(selectedPlayerProfile.player.dateOfBirth)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Nationality</p>
                  <p className="font-medium">
                    {selectedPlayerProfile.player.nationality || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Date of birth</p>
                  <p className="font-medium">
                    {selectedPlayerProfile.player.dateOfBirth || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Goals</p>
                  <p className="font-medium">{selectedPlayerProfile.goals}</p>
                </div>
                <div>
                  <p className="text-gray-500">Assists</p>
                  <p className="font-medium">
                    {selectedPlayerProfile.assists ?? "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Penalties</p>
                  <p className="font-medium">
                    {selectedPlayerProfile.penalties ?? "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Matches played</p>
                  <p className="font-medium">
                    {selectedPlayerProfile.playedMatches ?? "N/A"}
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
