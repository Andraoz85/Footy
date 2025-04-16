import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import TablesContent from "@/components/layout/TablesContent";
import { LeagueProvider } from "@/lib/context/LeagueContext";

export default function TablesPage() {
  return (
    <LeagueProvider>
      <div className="flex flex-col min-h-screen bg-gray-100">
        <Header />
        <div className="flex-grow flex flex-col md:flex-row max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 gap-6">
          <Sidebar />
          <TablesContent />
        </div>
        <Footer />
      </div>
    </LeagueProvider>
  );
}
