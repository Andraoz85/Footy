import AppShell from "@/components/layout/AppShell";
import CompetitionNav from "@/components/competition/CompetitionNav";
import CompetitionOverview from "@/components/competition/CompetitionOverview";
import { getLeagueIdFromParam } from "@/lib/league-routing";
import { notFound } from "next/navigation";

interface CompetitionPageProps {
  params: Promise<{
    leagueId: string;
  }>;
}

export default async function CompetitionPage({ params }: CompetitionPageProps) {
  const resolvedParams = await params;
  const leagueId = getLeagueIdFromParam(resolvedParams.leagueId);
  if (!leagueId) notFound();

  return (
    <AppShell>
      <CompetitionNav leagueId={leagueId} />
      <CompetitionOverview leagueId={leagueId} />
    </AppShell>
  );
}
