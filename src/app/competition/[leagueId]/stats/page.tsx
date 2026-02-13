import AppShell from "@/components/layout/AppShell";
import CompetitionNav from "@/components/competition/CompetitionNav";
import CompetitionStatsPage from "@/components/competition/CompetitionStatsPage";
import { getLeagueIdFromParam } from "@/lib/league-routing";
import { notFound } from "next/navigation";

interface CompetitionStatsRouteProps {
  params: Promise<{
    leagueId: string;
  }>;
}

export default async function CompetitionStatsRoute({
  params,
}: CompetitionStatsRouteProps) {
  const resolvedParams = await params;
  const leagueId = getLeagueIdFromParam(resolvedParams.leagueId);
  if (!leagueId) notFound();

  return (
    <AppShell>
      <CompetitionNav leagueId={leagueId} />
      <CompetitionStatsPage leagueId={leagueId} />
    </AppShell>
  );
}
