import { Match } from "@/lib/api/types";
import { Skeleton } from "./ui/skeleton";
import Image from "next/image";
import Link from "next/link";
import { LeagueId } from "@/lib/api/leagues";

const matchDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface FixturesListProps {
  matches: Match[];
  isLoading: boolean;
  leagueId?: LeagueId;
}

export default function FixturesList({
  matches,
  isLoading,
  leagueId,
}: FixturesListProps) {
  if (isLoading) {
    return <Skeleton className="h-12 sm:h-16" />;
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {matches.map((match) => (
        <div
          key={match.id}
          className="rounded-lg border border-zinc-800 bg-zinc-900/35 p-3 transition-colors hover:bg-zinc-900/60 sm:p-4"
        >
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800/70 pb-2 md:hidden">
            <div className="text-[11px] text-zinc-400">
              {matchDateFormatter.format(new Date(match.utcDate))}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">
              {match.status}
            </div>
          </div>

          <div className="mt-2 space-y-2 md:mt-0 md:hidden">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/team/${match.homeTeam.id}${
                  leagueId ? `?league=${leagueId}` : ""
                }`}
                className="inline-flex min-w-0 items-center gap-2"
              >
                <div className="relative h-6 w-6">
                  {match.homeTeam.crest && (
                    <Image
                      src={match.homeTeam.crest}
                      alt={match.homeTeam.shortName}
                      fill
                      sizes="24px"
                      className="object-contain"
                      priority={false}
                    />
                  )}
                </div>
                <span className="truncate text-sm font-medium text-zinc-100 hover:underline">
                  {match.homeTeam.shortName}
                </span>
              </Link>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/team/${match.awayTeam.id}${
                  leagueId ? `?league=${leagueId}` : ""
                }`}
                className="inline-flex min-w-0 items-center gap-2"
              >
                <div className="relative h-6 w-6">
                  {match.awayTeam.crest && (
                    <Image
                      src={match.awayTeam.crest}
                      alt={match.awayTeam.shortName}
                      fill
                      sizes="24px"
                      className="object-contain"
                      priority={false}
                    />
                  )}
                </div>
                <span className="truncate text-sm font-medium text-zinc-100 hover:underline">
                  {match.awayTeam.shortName}
                </span>
              </Link>
            </div>
          </div>

          <div className="hidden items-center justify-between md:flex">
            <div className="flex flex-1 items-center gap-1 sm:gap-2">
              <Link
                href={`/team/${match.homeTeam.id}${
                  leagueId ? `?league=${leagueId}` : ""
                }`}
                className="inline-flex min-w-0 items-center gap-1 sm:gap-2"
              >
                <div className="relative h-6 w-6 sm:h-8 sm:w-8">
                  {match.homeTeam.crest && (
                    <Image
                      src={match.homeTeam.crest}
                      alt={match.homeTeam.shortName}
                      fill
                      sizes="(max-width: 640px) 24px, 32px"
                      className="object-contain"
                      priority={false}
                    />
                  )}
                </div>
                <span className="truncate text-sm font-medium text-zinc-100 hover:underline sm:text-base">
                  {match.homeTeam.shortName}
                </span>
              </Link>
            </div>

            <div className="min-w-[80px] px-1 text-center sm:min-w-[100px] sm:px-2">
              <div className="text-xs text-zinc-400 sm:text-sm">
                {matchDateFormatter.format(new Date(match.utcDate))}
              </div>
            </div>

            <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2">
              <Link
                href={`/team/${match.awayTeam.id}${
                  leagueId ? `?league=${leagueId}` : ""
                }`}
                className="inline-flex min-w-0 items-center gap-1 sm:gap-2"
              >
                <span className="truncate text-sm font-medium text-zinc-100 hover:underline sm:text-base">
                  {match.awayTeam.shortName}
                </span>
                <div className="relative h-6 w-6 sm:h-8 sm:w-8">
                  {match.awayTeam.crest && (
                    <Image
                      src={match.awayTeam.crest}
                      alt={match.awayTeam.shortName}
                      fill
                      sizes="(max-width: 640px) 24px, 32px"
                      className="object-contain"
                      priority={false}
                    />
                  )}
                </div>
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
