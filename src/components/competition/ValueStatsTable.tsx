import { LeagueId } from "@/lib/api/leagues";
import { ScrapedStatEntry } from "@/lib/api/types";
import Link from "next/link";

interface ValueStatsTableProps {
  entries: ScrapedStatEntry[];
  leagueId: LeagueId;
  title: string;
  subjectLabel?: string;
  showTeamColumn?: boolean;
  resolveEntryHref?: (entry: ScrapedStatEntry, field: "subject" | "team") => string | null;
}

export default function ValueStatsTable({
  entries,
  leagueId,
  title,
  subjectLabel = "Player",
  showTeamColumn = true,
  resolveEntryHref,
}: ValueStatsTableProps) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/35">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-100">
        {title}
      </div>
      {entries.length === 0 ? (
        <div className="p-4 text-sm text-zinc-400">No data available.</div>
      ) : (
        <>
          <div className="space-y-2 p-2 md:hidden">
            {entries.map((entry, index) => {
              const subjectHref = resolveEntryHref?.(entry, "subject") || null;
              const teamHref = resolveEntryHref?.(entry, "team") || null;
              return (
                <div
                  key={`${entry.player}-${entry.team}-${index}`}
                  className="rounded-md border border-zinc-800 bg-zinc-900/70 p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-zinc-400">#{index + 1}</div>
                      {showTeamColumn || !subjectHref ? (
                        <p className="truncate text-sm font-medium text-zinc-100">{entry.player}</p>
                      ) : (
                        <Link href={subjectHref} className="truncate text-sm font-medium text-zinc-100 hover:underline">
                          {entry.player}
                        </Link>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] uppercase text-zinc-400">Total</div>
                      <div className="text-sm font-semibold text-zinc-100">{entry.value}</div>
                    </div>
                  </div>
                  {showTeamColumn ? (
                    teamHref ? (
                      <Link href={teamHref} className="mt-2 inline-block truncate text-xs text-zinc-300 hover:text-zinc-100">
                        {entry.team}
                      </Link>
                    ) : (
                      <Link href={`/competition/${leagueId}`} className="mt-2 inline-block truncate text-xs text-zinc-300 hover:text-zinc-100">
                        {entry.team}
                      </Link>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">{subjectLabel}</th>
                {showTeamColumn ? <th className="px-4 py-3">Team</th> : null}
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                (() => {
                  const subjectHref = resolveEntryHref?.(entry, "subject") || null;
                  const teamHref = resolveEntryHref?.(entry, "team") || null;
                  return (
                <tr
                  key={`${entry.player}-${entry.team}-${index}`}
                  className="border-b border-zinc-800/70 text-sm last:border-b-0"
                >
                  <td className="px-4 py-3 text-zinc-400">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-zinc-100">
                    {showTeamColumn || !subjectHref ? (
                      <span>{entry.player}</span>
                    ) : (
                      <Link
                        href={subjectHref}
                        className="hover:text-zinc-100 hover:underline"
                      >
                        {entry.player}
                      </Link>
                    )}
                  </td>
                  {showTeamColumn ? (
                    <td className="px-4 py-3 text-zinc-300">
                      {teamHref ? (
                        <Link
                          href={teamHref}
                          className="hover:text-zinc-100"
                        >
                          {entry.team}
                        </Link>
                      ) : (
                        <Link href={`/competition/${leagueId}`} className="hover:text-zinc-100">
                          {entry.team}
                        </Link>
                      )}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-right font-semibold text-zinc-100">
                    {entry.value}
                  </td>
                </tr>
                  );
                })()
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  );
}
