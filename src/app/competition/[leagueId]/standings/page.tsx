import AppShell from "@/components/layout/AppShell";
import CompetitionNav from "@/components/competition/CompetitionNav";
import CompetitionStandingsPage from "@/components/competition/CompetitionStandingsPage";
import { getLeagueIdFromParam } from "@/lib/league-routing";
import { notFound } from "next/navigation";

interface CompetitionStandingsRouteProps {
  params: Promise<{
    leagueId: string;
  }>;
}

export default async function CompetitionStandingsRoute({
  params,
}: CompetitionStandingsRouteProps) {
  const resolvedParams = await params;
  const leagueId = getLeagueIdFromParam(resolvedParams.leagueId);
  if (!leagueId) notFound();

  return (
    <AppShell>
      <CompetitionNav leagueId={leagueId} />
      <CompetitionStandingsPage leagueId={leagueId} />
    </AppShell>
  );
}
