export interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface Match {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  homeTeam: Team;
  awayTeam: Team;
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
}

export interface MatchResponse {
  matches: Match[];
  competition: {
    id: number;
    name: string;
    code: string;
    emblem: string;
  };
}
export interface TablePosition {
  position: number;
  team: Team;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form?: string | null;
}

export interface TableGroup {
  stage: string;
  type: string;
  group: string | null;
  table: TablePosition[];
}

export interface StandingsResponse {
  standings?: TableGroup[];
  competition?: {
    id: number;
    name: string;
    code: string;
    emblem: string;
    type: string;
  };
  season?: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
  };
  area?: {
    id: number;
    name: string;
    code: string;
    flag: string;
  };
  filters?: {
    season: string;
  };
  // Error fields
  errorCode?: number;
  message?: string;
}
