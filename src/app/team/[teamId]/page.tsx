import AppShell from "@/components/layout/AppShell";
import TeamContent from "@/components/team/TeamContent";
import { LEAGUES, LeagueId } from "@/lib/api/leagues";

interface TeamPageProps {
  params: Promise<{
    teamId: string;
  }>;
  searchParams: Promise<{
    tab?: string;
    league?: string;
  }>;
}

export default async function TeamPage({ params, searchParams }: TeamPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const teamId = Number(resolvedParams.teamId);
  const leagueParam = resolvedSearchParams.league;
  const leagueId =
    leagueParam && leagueParam in LEAGUES ? (leagueParam as LeagueId) : null;
  const activeTab = resolvedSearchParams.tab || "summary";

  if (!Number.isFinite(teamId)) {
    return (
      <AppShell>
        <div className="rounded-lg border border-zinc-800 bg-[#0b111b] px-4 py-6 text-zinc-100">
          Invalid team id.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
        <TeamContent teamId={teamId} leagueId={leagueId} activeTab={activeTab} />
    </AppShell>
  );
}
