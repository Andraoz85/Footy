import { TableGroup } from "@/lib/api/types";
import Image from "next/image";
import { Skeleton } from "./ui/skeleton";
import Link from "next/link";
import { LeagueId } from "@/lib/api/leagues";

interface LeagueTableProps {
  standings: TableGroup[];
  isLoading: boolean;
  leagueId?: LeagueId;
}

function renderFormPills(form: string | null | undefined) {
  if (!form) {
    return <span className="text-zinc-500">N/A</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {form.split(",").map((result, index) => {
        const value = result.trim().toUpperCase();
        const classes =
          value === "W"
            ? "bg-emerald-500/20 text-emerald-300"
            : value === "L"
              ? "bg-red-500/20 text-red-300"
              : value === "D"
                ? "bg-zinc-700 text-zinc-200"
                : "bg-zinc-800 text-zinc-300";

        return (
          <span
            key={`${value}-${index}`}
            className={`h-5 min-w-5 rounded px-1 text-[11px] font-semibold leading-5 ${classes}`}
          >
            {value || "-"}
          </span>
        );
      })}
    </div>
  );
}

export default function LeagueTable({
  standings,
  isLoading,
  leagueId,
}: LeagueTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full bg-zinc-800" />
        <Skeleton className="h-10 w-full bg-zinc-800" />
        <Skeleton className="h-10 w-full bg-zinc-800" />
        <Skeleton className="h-10 w-full bg-zinc-800" />
        <Skeleton className="h-10 w-full bg-zinc-800" />
      </div>
    );
  }

  if (!standings || standings.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-zinc-200">
        <p>No table data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {standings.map((group, groupIndex) => (
        <div
          key={groupIndex}
          className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/35"
        >
          <div className="space-y-2 p-2 md:hidden">
            {group.table.map((position) => (
              <div
                key={position.team.id}
                className="rounded-md border border-zinc-800 bg-zinc-900/70 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/team/${position.team.id}${leagueId ? `?league=${leagueId}` : ""}`}
                    className="inline-flex min-w-0 items-center gap-2"
                  >
                    <span className="w-5 text-xs font-semibold text-zinc-400">
                      {position.position}
                    </span>
                    {position.team.crest ? (
                      <div className="relative h-5 w-5 flex-shrink-0">
                        <Image
                          src={position.team.crest}
                          alt={position.team.name}
                          fill
                          sizes="20px"
                          className="object-contain"
                        />
                      </div>
                    ) : null}
                    <span className="truncate text-sm font-medium text-zinc-100">
                      {position.team.shortName || position.team.name}
                    </span>
                  </Link>
                  <span className="text-sm font-bold text-zinc-100">
                    {position.points} pts
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-300">
                  <span>P {position.playedGames}</span>
                  <span>W {position.won}</span>
                  <span>D {position.draw}</span>
                  <span>L {position.lost}</span>
                  <span>GD {position.goalDifference}</span>
                </div>
                <div className="mt-2">{renderFormPills(position.form)}</div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="bg-zinc-900 text-left text-zinc-300">
                  <th className="w-8 p-1.5 sm:p-2.5">#</th>
                  <th className="p-1.5 sm:p-2.5">Team</th>
                  <th className="w-8 p-1.5 text-center sm:w-10 sm:p-2.5">P</th>
                  <th className="w-8 p-1.5 text-center sm:w-10 sm:p-2.5">W</th>
                  <th className="w-8 p-1.5 text-center sm:w-10 sm:p-2.5">D</th>
                  <th className="w-8 p-1.5 text-center sm:w-10 sm:p-2.5">L</th>
                  <th className="w-8 p-1.5 text-center sm:w-10 sm:p-2.5">GD</th>
                  <th className="w-28 p-1.5 text-center sm:p-2.5">Form</th>
                  <th className="w-14 p-1.5 text-center font-bold sm:p-2.5">
                    Pts
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.table.map((position) => (
                  <tr
                    key={position.team.id}
                    className="border-t border-zinc-800 text-zinc-100 transition-colors hover:bg-zinc-800/60"
                  >
                    <td className="p-1.5 sm:p-2.5">{position.position}</td>
                    <td className="p-1.5 sm:p-2.5">
                      <Link
                        href={`/team/${position.team.id}${leagueId ? `?league=${leagueId}` : ""}`}
                        className="flex items-center gap-2"
                      >
                        {position.team.crest ? (
                          <div className="relative h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6">
                            <Image
                              src={position.team.crest}
                              alt={position.team.name}
                              fill
                              sizes="(max-width: 640px) 20px, 24px"
                              className="object-contain"
                            />
                          </div>
                        ) : null}
                        <span className="max-w-[100px] truncate text-sm font-medium sm:max-w-full sm:text-base">
                          {position.team.shortName || position.team.name}
                        </span>
                      </Link>
                    </td>
                    <td className="p-1.5 text-center sm:p-2.5">
                      {position.playedGames}
                    </td>
                    <td className="p-1.5 text-center sm:p-2.5">{position.won}</td>
                    <td className="p-1.5 text-center sm:p-2.5">{position.draw}</td>
                    <td className="p-1.5 text-center sm:p-2.5">{position.lost}</td>
                    <td className="p-1.5 text-center sm:p-2.5">
                      {position.goalDifference}
                    </td>
                    <td className="p-1.5 text-center sm:p-2.5">
                      {renderFormPills(position.form)}
                    </td>
                    <td className="p-1.5 text-center font-bold sm:p-2.5">
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
