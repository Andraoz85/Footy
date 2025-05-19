<img src="/public/footylogo.png" width="100" height="100">
https://footy-umber.vercel.app/

Footy is a web application for displaying upcoming football matches and standings from various European leagues. The app uses the Football Data API to fetch the latest match data and presents it in a user-friendly interface.

## Features

- **Match Schedule**: View upcoming matches from multiple leagues
- **League Tables**: See current standings for each league
- **Filtering**: Filter matches and tables by league
- **Responsive Design**: Works well on both mobile and desktop
- **Caching**: Optimized to minimize API calls with local caching

## Technologies

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui components
- **API**: Football Data API (https://www.football-data.org/)

## Getting Started

### Prerequisites

- Node.js (version 18 or later)
- pnpm (recommended package manager) or npm/yarn
- API key from Football Data API (https://www.football-data.org/client/register)

### Installation

1. Clone the repository:
      ```bash
   git clone <repository-url>
   cd footy
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a `.env.local` file in the project root and add your API key:

   ```
   FOOTBALL_API_KEY=your_api_key_here
   ```

4. Start the development server:

   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

## Project Structure

```
footy/
├── public/             # Static files (images, icons)
├── src/
│   ├── app/            # Next.js App Router
│   │   ├── api/        # API routes for server handling
│   │   └── ...
│   ├── components/     # React components
│   │   ├── layout/     # Layout components (Header, Footer, etc.)
│   │   ├── ui/         # Basic UI components (shadcn/ui)
│   │   └── ...         # Functional components
│   └── lib/            # Utilities, API integrations, etc.
│       ├── api/        # API-related code
│       ├── context/    # React Context providers
│       └── ...
└── ...
```

## API Usage

This app uses the Football Data API, which has certain limitations in the free version:

- 10 calls per minute
- Limited number of leagues
- Limited historical data

The app implements caching to reduce the number of API calls and handle rate limits.

## Customization
To add or change leagues, edit the `LEAGUES` constant in `src/lib/api/leagues.ts`. <br>
Go to https://www.football-data.org/coverage to see which leagues are included in each tier.


## Contributions
Contributions are welcome! Open an issue or pull request.

## License
MIT
