import { LeagueId } from "@/lib/api/leagues";
import { Match } from "@/lib/api/types";
import Image from "next/image";
import Link from "next/link";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

interface CompetitionMatchListProps {
  matches: Match[];
  leagueId: LeagueId;
  mode: "fixtures" | "results";
}

export default function CompetitionMatchList({
  matches,
  leagueId,
  mode,
}: CompetitionMatchListProps) {
  const sortedMatches = [...matches].sort((a, b) =>
    mode === "results"
      ? new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
      : new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
  );

  if (sortedMatches.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-400">
        {mode === "results"
          ? "No recent results available."
          : "No upcoming fixtures available."}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {sortedMatches.map((match) => {
        const matchDate = new Date(match.utcDate);
        return (
          <div
            key={match.id}
            className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/35 p-3"
          >
            <div className="w-14 text-xs text-zinc-400">
              <div>{dateFormatter.format(matchDate).toUpperCase()}</div>
              <div>{mode === "results" ? "FT" : timeFormatter.format(matchDate)}</div>
            </div>

            <div className="flex-1 space-y-2">
              <Link
                href={`/team/${match.homeTeam.id}?league=${leagueId}`}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  {match.homeTeam.crest ? (
                    <span className="relative h-5 w-5">
                      <Image
                        src={match.homeTeam.crest}
                        alt={match.homeTeam.name}
                        fill
                        sizes="20px"
                        className="object-contain"
                      />
                    </span>
                  ) : null}
                  <span className="text-sm font-medium text-zinc-100">
                    {match.homeTeam.shortName || match.homeTeam.name}
                  </span>
                </span>
                {mode === "results" ? (
                  <span className="text-sm font-semibold text-zinc-100">
                    {match.score.fullTime.home ?? "-"}
                  </span>
                ) : null}
              </Link>

              <Link
                href={`/team/${match.awayTeam.id}?league=${leagueId}`}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  {match.awayTeam.crest ? (
                    <span className="relative h-5 w-5">
                      <Image
                        src={match.awayTeam.crest}
                        alt={match.awayTeam.name}
                        fill
                        sizes="20px"
                        className="object-contain"
                      />
                    </span>
                  ) : null}
                  <span className="text-sm font-medium text-zinc-100">
                    {match.awayTeam.shortName || match.awayTeam.name}
                  </span>
                </span>
                {mode === "results" ? (
                  <span className="text-sm font-semibold text-zinc-100">
                    {match.score.fullTime.away ?? "-"}
                  </span>
                ) : null}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
