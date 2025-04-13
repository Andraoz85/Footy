import { Match } from "@/lib/api/types";
import { Skeleton } from "./ui/skeleton";

interface FixturesListProps {
  matches: Match[];
  isLoading: boolean;
}

export default function FixturesList({
  matches,
  isLoading,
}: FixturesListProps) {
  if (isLoading) {
    return (
      <Skeleton className="h-12 sm:h-16" />
    );
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {matches.map((match) => (
        <div
          key={match.id}
          className="bg-white/80 backdrop-blur-sm rounded-lg shadow p-3 sm:p-4 hover:bg-white/90 transition-colors"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1 sm:gap-2 flex-1">
              <img
                src={match.homeTeam.crest}
                alt={match.homeTeam.shortName}
                className="w-6 h-6 sm:w-8 sm:h-8 object-contain"
              />
              <span className="font-medium text-sm sm:text-base">
                {match.homeTeam.shortName}
              </span>
            </div>

            <div className="text-center px-1 sm:px-2 min-w-[80px] sm:min-w-[100px]">
              <div className="text-xs sm:text-sm text-gray-500">
                {new Date(match.utcDate).toLocaleDateString("sv-SE", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-end">
              <span className="font-medium text-sm sm:text-base">
                {match.awayTeam.shortName}
              </span>
              <img
                src={match.awayTeam.crest}
                alt={match.awayTeam.shortName}
                className="w-6 h-6 sm:w-8 sm:h-8 object-contain"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
