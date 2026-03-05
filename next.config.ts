import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "crests.football-data.org",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "a.espncdn.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.a.transfermarkt.technology",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "tmssl.akamaized.net",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
