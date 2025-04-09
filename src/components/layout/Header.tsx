import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo/Brand? */}
            <div className="flex items-center">
              <Link href="/">
                <img
                  src="/footylogo.png"
                  alt="Footy"
                  width={120}
                  height={120}
                />
              </Link>
            </div>
            {/* Navigation Links */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/"
                className="border-transparent text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Fixtures
              </Link>
              <Link
                href="/tables"
                className="border-transparent text-gray-500 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Tables
              </Link>
              <Link
                href="/players"
                className="border-transparent text-gray-500 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Players
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
