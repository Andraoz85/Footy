import { LEAGUES, LeagueId } from "@/lib/api/leagues";

export function getLeagueIdFromParam(value: string): LeagueId | null {
  return value in LEAGUES ? (value as LeagueId) : null;
}
