"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LeagueId, LEAGUES } from "@/lib/api/leagues";
import { getLikelyCurrentSeasonStartYear, getPlayerProfile } from "@/lib/api/football";
import { PlayerProfileResponse } from "@/lib/api/types";

interface PlayerContentProps {
  playerId: number;
  leagueId: LeagueId | null;
  playerNameFromQuery: string | null;
  teamIdFromQuery: number | null;
  teamNameFromQuery: string | null;
}

function getAge(dateOfBirth?: string | null): string {
  if (!dateOfBirth) return "N/A";
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return "N/A";

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasBirthdayPassedThisYear =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasBirthdayPassedThisYear) age -= 1;
  return age.toString();
}

function formatDateOfBirth(dateOfBirth?: string | null): string {
  if (!dateOfBirth) return "N/A";
  const parsed = new Date(dateOfBirth);
  if (Number.isNaN(parsed.getTime())) {
    const match = dateOfBirth.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : dateOfBirth;
  }
  return parsed.toISOString().split("T")[0];
}

export default function PlayerContent({
  playerId,
  leagueId,
  playerNameFromQuery,
  teamIdFromQuery,
  teamNameFromQuery,
}: PlayerContentProps) {
  const seasonStart = getLikelyCurrentSeasonStartYear();
  const [profile, setProfile] = useState<PlayerProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;
    if (!leagueId) {
      setIsLoading(false);
      return;
    }

    async function loadPlayer() {
      try {
        if (isActive) {
          setIsLoading(true);
          setError(null);
        }
        const data = await getPlayerProfile(playerId, {
          leagueId,
          playerName: playerNameFromQuery,
          teamId: teamIdFromQuery,
          teamName: teamNameFromQuery,
        });
        if (!isActive) return;
        setProfile(data);
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load player data.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadPlayer();
    return () => {
      isActive = false;
    };
  }, [
    leagueId,
    playerId,
    playerNameFromQuery,
    teamIdFromQuery,
    teamNameFromQuery,
    seasonStart,
    reloadKey,
  ]);

  const resolvedName = profile?.player.name || playerNameFromQuery || `Player #${playerId}`;
  const resolvedTeamName = profile?.team?.name || teamNameFromQuery || "Unknown Team";
  const resolvedTeamId = profile?.team?.id || teamIdFromQuery;
  const resolvedLeagueName = leagueId ? LEAGUES[leagueId].name : "Unknown League";

  const stats = useMemo(
    () => ({
      goals: profile?.stats?.goals ?? null,
      assists: profile?.stats?.assists ?? null,
      penalties: profile?.stats?.penalties ?? null,
      playedMatches: profile?.stats?.playedMatches ?? null,
    }),
    [profile]
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 bg-zinc-800" />
        <Skeleton className="h-28 bg-zinc-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="mb-2 font-semibold text-red-300">Data Unavailable</p>
        <p className="mb-3 text-zinc-200">{error}</p>
        <Button onClick={() => setReloadKey((value) => value + 1)} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col rounded-xl border border-zinc-800 bg-[#0b111b]">
      <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-zinc-100">{resolvedName}</h1>
              <p className="mt-1 text-sm text-zinc-400">
                {resolvedLeagueName} • Season {seasonStart}/{(seasonStart + 1).toString().slice(2)}
              </p>
              <div className="mt-3 text-sm text-zinc-300">
                Team:{" "}
                {resolvedTeamId && leagueId ? (
                  <Link
                    href={`/team/${resolvedTeamId}?league=${leagueId}`}
                    className="text-zinc-100 underline-offset-2 hover:underline"
                  >
                    {resolvedTeamName}
                  </Link>
                ) : (
                  <span>{resolvedTeamName}</span>
                )}
              </div>
            </div>
            {profile?.player.photo ? (
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
                <Image
                  src={profile.player.photo}
                  alt={resolvedName}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-zinc-500">Age</p>
            <p className="text-lg font-semibold text-zinc-100">
              {profile?.player.age ?? getAge(profile?.player.dateOfBirth)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Position</p>
            <p className="text-lg font-semibold text-zinc-100">
              {profile?.player.position || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Nationality</p>
            <p className="text-lg font-semibold text-zinc-100">
              {profile?.player.nationality || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Date of Birth</p>
            <p className="text-lg font-semibold text-zinc-100">
              {formatDateOfBirth(profile?.player.dateOfBirth)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-zinc-500">Goals</p>
            <p className="text-lg font-semibold text-zinc-100">{stats.goals ?? "N/A"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Assists</p>
            <p className="text-lg font-semibold text-zinc-100">{stats.assists ?? "N/A"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Penalties</p>
            <p className="text-lg font-semibold text-zinc-100">{stats.penalties ?? "N/A"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Matches Played</p>
            <p className="text-lg font-semibold text-zinc-100">
              {stats.playedMatches ?? "N/A"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
