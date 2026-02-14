export interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string | null;
}

export interface Player {
  id: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  section?: string | null;
  position?: string | null;
  shirtNumber?: number | null;
  lastUpdated?: string | null;
}

export interface Match {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  competition?: {
    name: string;
    code?: string | null;
  };
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

export interface ScorerEntry {
  player: Player;
  team: Team;
  playedMatches?: number | null;
  goals: number;
  assists?: number | null;
  penalties?: number | null;
}

export interface ScorersResponse {
  count: number;
  scorers: ScorerEntry[];
  competition?: {
    id: number;
    name: string;
    code: string;
    emblem: string;
  };
  season?: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
  };
  errorCode?: number;
  message?: string;
}

export interface CompetitionTeamsResponse {
  count: number;
  teams: Array<
    Team & {
      venue?: string | null;
      website?: string | null;
      founded?: number | null;
      squad?: Player[];
    }
  >;
  competition?: {
    id: number;
    name: string;
    code: string;
    emblem: string;
  };
  season?: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
  };
  errorCode?: number;
  message?: string;
}

export interface TeamDetailsResponse extends Team {
  founded?: number | null;
  venue?: string | null;
  clubColors?: string | null;
  address?: string | null;
  website?: string | null;
  runningCompetitions?: Array<{
    id: number;
    name: string;
    code: string;
    emblem?: string | null;
    type?: string | null;
  }>;
  coach?: {
    id?: number;
    name?: string;
    dateOfBirth?: string | null;
    nationality?: string | null;
  } | null;
  squad?: Player[];
  area?: {
    id?: number;
    name?: string;
    code?: string;
    flag?: string | null;
  } | null;
  errorCode?: number;
  message?: string;
}

export interface TeamMatchesResponse {
  matches: Match[];
  filters?: {
    limit?: string;
    status?: string;
    competitions?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  resultSet?: {
    count?: number;
    first?: string;
    last?: string;
    played?: number;
  };
  errorCode?: number;
  message?: string;
}

export interface ApiFootballSquadPlayer {
  id: number;
  name: string;
  age?: number | null;
  number?: number | null;
  position?: string | null;
  photo?: string | null;
  nationalities?: string[];
  dateOfBirth?: string | null;
}

export interface ApiFootballTransfer {
  player: {
    id: number;
    name: string;
  };
  update?: string | null;
  date?: string | null;
  type?: string | null;
  fee?: string | null;
  teams: {
    in?: {
      id?: number;
      name?: string;
      logo?: string | null;
    } | null;
    out?: {
      id?: number;
      name?: string;
      logo?: string | null;
    } | null;
  };
}

export interface TeamExtraDataResponse {
  resolvedTeam: {
    id: number;
    name: string;
    logo?: string | null;
    country?: string | null;
  };
  squad: ApiFootballSquadPlayer[];
  transfers: ApiFootballTransfer[];
  errorCode?: number;
  message?: string;
}

export interface ScrapedStatEntry {
  player: string;
  team: string;
  value: number;
  entityId?: number | null;
  teamId?: number | null;
}

export interface ScrapedCompetitionStatsResponse {
  league: string;
  source: string;
  fetchedAt: string;
  redCards: ScrapedStatEntry[];
  yellowCards: ScrapedStatEntry[];
  shotsOnTarget: ScrapedStatEntry[];
  _meta?: {
    stale?: boolean;
    message?: string;
  };
  errorCode?: number;
  message?: string;
}

export interface PlayerProfileResponse {
  player: Player & {
    photo?: string | null;
    age?: number | null;
  };
  team: Team | null;
  stats: {
    goals?: number | null;
    assists?: number | null;
    penalties?: number | null;
    playedMatches?: number | null;
  };
  source?: string;
  _meta?: {
    stale?: boolean;
    message?: string;
  };
  errorCode?: number;
  message?: string;
}
