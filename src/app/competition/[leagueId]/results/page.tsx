import AppShell from "@/components/layout/AppShell";
import CompetitionNav from "@/components/competition/CompetitionNav";
import CompetitionMatchesPage from "@/components/competition/CompetitionMatchesPage";
import { getLeagueIdFromParam } from "@/lib/league-routing";
import { notFound } from "next/navigation";

interface CompetitionResultsPageProps {
  params: Promise<{
    leagueId: string;
  }>;
}

export default async function CompetitionResultsPage({
  params,
}: CompetitionResultsPageProps) {
  const resolvedParams = await params;
  const leagueId = getLeagueIdFromParam(resolvedParams.leagueId);
  if (!leagueId) notFound();

  return (
    <AppShell>
      <CompetitionNav leagueId={leagueId} />
      <CompetitionMatchesPage leagueId={leagueId} mode="results" />
    </AppShell>
  );
}
