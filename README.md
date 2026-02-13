# Footy

Live app: https://footy-umber.vercel.app/

Footy is a football web app focused on the top European competitions, with dedicated pages for competitions, teams, and players.

It currently uses a multi-source data approach:

- ESPN endpoints for fixtures, results, standings, teams, and scoring tables
- Transfermarkt scraping/parsing for extra team and player details
- Football-data crest assets for competition/team branding

## Features

- Competition hub with tabs for `Overview`, `Fixtures`, `Results`, `Standings`, and `Stats`
- Global search across competitions, teams, and players
- Team pages with tabs for `Summary`, `Results`, `Fixtures`, `Standings`, `Transfers`, and `Squad`
- Player profile pages with bio + season stats (goals, assists, penalties, matches)
- Extended competition stats (top scorers, assists, red cards, yellow cards, shots on target)
- Client-side + server-side caching, including stale-cache fallback on upstream failures
- Responsive UI for mobile and desktop

## Competitions Included

- Premier League (`PL`)
- Championship (`ELC`)
- Serie A (`SA`)
- La Liga (`PD`)
- Bundesliga (`BL1`)
- Ligue 1 (`FL1`)
- Champions League (`CL`)

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- shadcn/ui + Radix UI primitives
- `cheerio`, `transfermarkt`, and `transfermarkt-parser` for external parsing/scraping

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone <repository-url>
cd footy
npm install
npm run dev
```

Open http://localhost:3000.

Note: the current codebase does not require a local API key for core functionality.

## Available Scripts

- `npm run dev` - Start development server (Turbopack)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Main Routes

- `/` - All upcoming fixtures across tracked competitions
- `/competition/[leagueId]` - Competition overview
- `/competition/[leagueId]/fixtures`
- `/competition/[leagueId]/results`
- `/competition/[leagueId]/standings`
- `/competition/[leagueId]/stats`
- `/team/[teamId]?league=[leagueId]&tab=[summary|results|fixtures|standings|transfers|squad]`
- `/player/[playerId]?league=[leagueId]&name=[playerName]&teamId=[teamId]&teamName=[teamName]`

## Project Structure

```text
footy/
|- public/
|- src/
|  |- app/
|  |  |- api/football/      # Internal API routes (fixtures, standings, teams, team, player, search, scraped stats)
|  |  |- competition/       # Competition routes (overview/fixtures/results/standings/stats)
|  |  |- team/[teamId]/
|  |  |- player/[playerId]/
|  |- components/
|  |  |- competition/
|  |  |- team/
|  |  |- player/
|  |  |- layout/
|  |  |- ui/
|  |- lib/
|  |  |- api/               # Client API wrappers + types
|  |  |- server/            # ESPN fetch helpers + in-memory route cache
|  |  |- context/
|  |  |- league-routing.ts
```

## Caching Strategy

- Browser cache via `localStorage` for frequently-used client data
- In-memory server cache per route with:
  - fresh TTL
  - stale window fallback when upstream requests fail

This reduces load on upstream providers and keeps pages usable during temporary outages.

## Data Source Notes

This project depends on third-party endpoints/pages that may change structure or availability. If upstream formats change, related parsers/endpoints may need updates.

## Customization

To add/remove competitions, update `src/lib/api/leagues.ts` and ensure related mapping fields stay aligned:

- `id`
- `espnLeagueCode`
- `transfermarktCompetitionId`
- branding fields (`name`, `emblem`)

## Contributing

Contributions are welcome via issues and pull requests.

## License

MIT
