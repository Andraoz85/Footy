import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LeagueProvider } from "@/lib/context/LeagueContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Footy",
  description: "Football fixtures and results",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LeagueProvider>{children}</LeagueProvider>
      </body>
    </html>
  );
}
