"use client";

import Link from "next/link";
import { SearchInput } from "@/components/SearchInput";
import Image from "next/image";

export default function Header() {
  return (
    <header className="border-b border-zinc-800 bg-[#0b111b]">
      <div className="mx-auto max-w-7xl px-3 sm:px-5 lg:px-6">
        <div className="py-2 md:py-0">
          <div className="flex flex-col gap-2 md:h-20 md:flex-row md:items-center md:gap-4">
            <Link className="relative z-10 mx-auto flex-shrink-0 md:mx-0" href="/">
              <Image
                src="/footylogo.png"
                alt="Footy"
                width={220}
                height={88}
                className="h-16 w-auto md:h-16 lg:h-20"
                priority
              />
            </Link>
            <div className="w-full md:flex md:flex-1 md:justify-center">
              <SearchInput className="w-full md:max-w-2xl" />
            </div>
            <div className="hidden md:block md:w-[220px]" aria-hidden />
          </div>
        </div>
      </div>
    </header>
  );
}
