import { ReactNode } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#070b12] text-zinc-100">
      <Header />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 bg-[#070b12] px-2 py-3 sm:gap-5 sm:px-5 sm:py-4 lg:flex-row lg:px-6">
        <Sidebar />
        <main className="min-w-0 flex-1 bg-[#070b12]">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
