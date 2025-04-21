"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileMenu } from "@/components/MobileMenu";
import { NAVIGATION } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/SearchInput";
import Image from "next/image";

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <Link className="flex-shrink-0" href="/">
            <Image
              src="/footylogo.png"
              alt="Footy"
              width={120}
              height={60}
              priority
            />
          </Link>

          {/* Search */}
          <SearchInput />

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            {NAVIGATION.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "border-green-600 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Mobile Menu */}
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
