"use client";

import { useState, useEffect } from "react";
import { StandingsResponse } from "@/lib/api/types";

export default function ApiTest() {
  const [data, setData] = useState<StandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState("PL");

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/football/standings?league=${league}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to fetch data");
      }

      setData(result);
      console.log("API response:", result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Test: Standings</h1>

      <div className="mb-4 flex items-center gap-2">
        <select
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="PL">Premier League</option>
          <option value="ELC">Championship</option>
          <option value="BL1">Bundesliga</option>
          <option value="SA">Serie A</option>
          <option value="PD">La Liga</option>
          <option value="FL1">Ligue 1</option>
          <option value="CL">Champions League</option>
        </select>

        <button
          onClick={fetchData}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Fetch Data
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {data && !loading && (
        <div>
          <h2 className="text-xl font-bold mb-2">
            {data.competition?.name} Standings
          </h2>

          <pre className="bg-gray-100 p-4">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
