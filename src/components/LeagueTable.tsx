import { TableGroup } from "@/lib/api/types";
import Image from "next/image";
import { Skeleton } from "./ui/skeleton";

interface LeagueTableProps {
  standings: TableGroup[];
  isLoading: boolean;
}

export default function LeagueTable({
  standings,
  isLoading,
}: LeagueTableProps) {
  if (isLoading) {
    return <Skeleton className="h-12 sm:h-16" />;
  }

  if (!standings || standings.length === 0) {
    return (
      <div className="bg-white/80 p-4 rounded-lg text-gray-800">
        <p>No table data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {standings.map((group, groupIndex) => (
        <div
          key={groupIndex}
          className="bg-white/80 rounded-lg overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-1.5 sm:p-2.5 w-8">#</th>
                  <th className="p-1.5 sm:p-2.5">Team</th>
                  <th className="p-1.5 sm:p-2.5 text-center w-8 sm:w-10">P</th>
                  <th className="p-1.5 sm:p-2.5 text-center w-8 sm:w-10">W</th>
                  <th className="p-1.5 sm:p-2.5 text-center w-8 sm:w-10">D</th>
                  <th className="p-1.5 sm:p-2.5 text-center w-8 sm:w-10">L</th>
                  <th className="p-1.5 sm:p-2.5 text-center w-8 sm:w-10">GD</th>
                  <th className="p-1.5 sm:p-2.5 text-center w-14 font-bold">
                    Pts
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.table.map((position) => (
                  <tr
                    key={position.team.id}
                    className="border-t border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-1.5 sm:p-2.5">{position.position}</td>
                    <td className="p-1.5 sm:p-2.5">
                      <div className="flex items-center gap-2">
                        {position.team.crest && (
                          <div className="relative w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0">
                            <Image
                              src={position.team.crest}
                              alt={position.team.name}
                              fill
                              sizes="(max-width: 640px) 20px, 24px"
                              className="object-contain"
                            />
                          </div>
                        )}
                        <span className="font-medium text-sm sm:text-base truncate max-w-[100px] sm:max-w-full">
                          {position.team.shortName || position.team.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-1.5 sm:p-2.5 text-center">
                      {position.playedGames}
                    </td>
                    <td className="p-1.5 sm:p-2.5 text-center">
                      {position.won}
                    </td>
                    <td className="p-1.5 sm:p-2.5 text-center">
                      {position.draw}
                    </td>
                    <td className="p-1.5 sm:p-2.5 text-center">
                      {position.lost}
                    </td>
                    <td className="p-1.5 sm:p-2.5 text-center">
                      {position.goalDifference}
                    </td>
                    <td className="p-1.5 sm:p-2.5 text-center font-bold">
                      {position.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
