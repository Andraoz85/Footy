"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type SearchResultType = "competition" | "team" | "player";

interface SearchResultItem {
  type: SearchResultType;
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

interface SearchResponse {
  query: string;
  results: SearchResultItem[];
}

const TYPE_LABEL: Record<SearchResultType, string> = {
  competition: "Competition",
  team: "Team",
  player: "Player",
};

interface SearchInputProps {
  className?: string;
}

export function SearchInput({ className }: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/football/search?q=${encodeURIComponent(trimmedQuery)}`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );
        if (!response.ok) {
          setResults([]);
          setIsOpen(true);
          setActiveIndex(-1);
          return;
        }
        const payload = (await response.json()) as SearchResponse;
        setResults(payload.results || []);
        setIsOpen(true);
        setActiveIndex(payload.results?.length ? 0 : -1);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setIsOpen(true);
          setActiveIndex(-1);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timeout);
      setIsLoading(false);
    };
  }, [trimmedQuery]);

  useEffect(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function navigateTo(item: SearchResultItem) {
    router.push(item.href);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const candidate = activeIndex >= 0 ? results[activeIndex] : results[0];
    if (candidate) {
      navigateTo(candidate);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className={`relative w-full min-w-0 ${className || ""}`}>
      <form onSubmit={handleSubmit}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (trimmedQuery.length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search teams, players, competitions..."
          className="h-10 border-zinc-700 bg-zinc-900/80 pl-10 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-500/60 sm:h-11 sm:text-base"
        />
      </form>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 shadow-xl">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-zinc-400">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-400">No results found.</div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto sm:max-h-80">
              {results.map((item, index) => (
                <li key={`${item.type}-${item.id}-${index}`}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => navigateTo(item)}
                    className={`w-full px-3 py-2 text-left transition-colors ${
                      index === activeIndex
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-200 hover:bg-zinc-800/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{item.label}</span>
                      <span className="text-[11px] uppercase tracking-wide text-zinc-400">
                        {TYPE_LABEL[item.type]}
                      </span>
                    </div>
                    {item.sublabel ? (
                      <div className="truncate text-xs text-zinc-400">{item.sublabel}</div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
