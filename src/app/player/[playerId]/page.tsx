import AppShell from "@/components/layout/AppShell";
import PlayerContent from "@/components/player/PlayerContent";
import { LEAGUES, LeagueId } from "@/lib/api/leagues";

interface PlayerPageProps {
  params: Promise<{
    playerId: string;
  }>;
  searchParams: Promise<{
    league?: string;
    name?: string;
    teamId?: string;
    teamName?: string;
  }>;
}

export default async function PlayerPage({ params, searchParams }: PlayerPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const playerId = Number(resolvedParams.playerId);
  const leagueParam = resolvedSearchParams.league;
  const leagueId =
    leagueParam && leagueParam in LEAGUES ? (leagueParam as LeagueId) : null;
  const teamIdParam = Number(resolvedSearchParams.teamId);

  return (
    <AppShell>
      <PlayerContent
        playerId={Number.isFinite(playerId) ? playerId : 0}
        leagueId={leagueId}
        playerNameFromQuery={resolvedSearchParams.name || null}
        teamIdFromQuery={Number.isFinite(teamIdParam) ? teamIdParam : null}
        teamNameFromQuery={resolvedSearchParams.teamName || null}
      />
    </AppShell>
  );
}
