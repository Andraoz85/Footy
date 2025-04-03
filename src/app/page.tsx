import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <Header />
      <div className="flex-grow flex flex-col md:flex-row max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Sidebar - ligor */}
        <aside className="w-full md:w-64 bg-white shadow rounded-lg p-4 mb-6 md:mb-0">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Leagues</h2>
          <div className="border-2 border-dashed border-gray-200 rounded-lg min-h-[200px] p-4 flex items-center justify-center">
            <p className="text-gray-500">Här kommer ligor att visas</p>
          </div>
        </aside>

        {/* Huvudinnehåll - kommande matcher */}
        <main className="flex-1 bg-green-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6 h-full">
            <h2 className="text-xl font-semibold text-white mb-4">
              Fixtures
            </h2>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 overflow-auto max-h-[calc(100vh-112px)]">
                <p className="text-white">
                  Här kommer kommande matcher att visas
                </p>              
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
