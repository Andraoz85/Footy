import { LeagueId } from "@/lib/api/leagues";
import { ScorerEntry } from "@/lib/api/types";
import Image from "next/image";
import Link from "next/link";

interface ScorersTableProps {
  entries: ScorerEntry[];
  leagueId: LeagueId;
  metric: "goals" | "assists";
  title?: string;
}

export default function ScorersTable({
  entries,
  leagueId,
  metric,
  title,
}: ScorersTableProps) {
  const label = metric === "assists" ? "Assists" : "Goals";

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/35">
      {title ? (
        <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-100">
          {title}
        </div>
      ) : null}
      {entries.length === 0 ? (
        <div className="p-4 text-sm text-zinc-400">No scorer data available.</div>
      ) : (
        <>
          <div className="space-y-2 p-2 md:hidden">
            {entries.map((entry, index) => (
              <div
                key={`${entry.player.id}-${entry.team.id}`}
                className="rounded-md border border-zinc-800 bg-zinc-900/70 p-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-400">#{index + 1}</div>
                    <Link
                      href={`/player/${entry.player.id}?league=${leagueId}&name=${encodeURIComponent(
                        entry.player.name
                      )}&teamId=${entry.team.id}&teamName=${encodeURIComponent(entry.team.name)}`}
                      className="block truncate text-sm font-medium text-zinc-100 hover:underline"
                    >
                      {entry.player.name}
                    </Link>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase text-zinc-400">{label}</div>
                    <div className="text-sm font-semibold text-zinc-100">
                      {metric === "assists" ? entry.assists ?? 0 : entry.goals}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/team/${entry.team.id}?league=${leagueId}`}
                  className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-300 hover:text-zinc-100"
                >
                  {entry.team.crest ? (
                    <span className="relative h-4 w-4">
                      <Image
                        src={entry.team.crest}
                        alt={entry.team.name}
                        fill
                        sizes="16px"
                        className="object-contain"
                      />
                    </span>
                  ) : null}
                  <span className="truncate">{entry.team.shortName || entry.team.name}</span>
                </Link>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[620px]">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3 text-right">{label}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={`${entry.player.id}-${entry.team.id}`} className="border-b border-zinc-800/70 text-sm last:border-b-0">
                  <td className="px-4 py-3 text-zinc-400">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-zinc-100">
                    <Link
                      href={`/player/${entry.player.id}?league=${leagueId}&name=${encodeURIComponent(
                        entry.player.name
                      )}&teamId=${entry.team.id}&teamName=${encodeURIComponent(entry.team.name)}`}
                      className="hover:underline"
                    >
                      {entry.player.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/team/${entry.team.id}?league=${leagueId}`}
                      className="inline-flex items-center gap-2 text-zinc-300 hover:text-zinc-100"
                    >
                      {entry.team.crest ? (
                        <span className="relative h-5 w-5">
                          <Image
                            src={entry.team.crest}
                            alt={entry.team.name}
                            fill
                            sizes="20px"
                            className="object-contain"
                          />
                        </span>
                      ) : null}
                      <span>{entry.team.shortName || entry.team.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-100">
                    {metric === "assists" ? entry.assists ?? 0 : entry.goals}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  );
}
