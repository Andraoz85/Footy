export const LEAGUES = {
  PL: {
    id: "PL",
    name: "Premier League",
    emblem: "https://crests.football-data.org/PL.png",
  },
  ELC: {
    id: "ELC",
    name: "Championship",
    emblem: "https://crests.football-data.org/ELC.png",
  },
  SA: {
    id: "SA",
    name: "Serie A",
    emblem: "https://crests.football-data.org/SA.png",
  },
  PD: {
    id: "PD",
    name: "La Liga",
    emblem: "https://crests.football-data.org/PD.png",
  },
  BL1: {
    id: "BL1",
    name: "Bundesliga",
    emblem: "https://crests.football-data.org/BL1.png",
  },
  FL1: {
    id: "FL1",
    name: "Ligue 1",
    emblem: "https://crests.football-data.org/FL1.png",
  },
  CL: {
    id: "CL",
    name: "Champions League",
    emblem: "https://crests.football-data.org/CL.png",
  },
} as const;

export type LeagueId = keyof typeof LEAGUES;
