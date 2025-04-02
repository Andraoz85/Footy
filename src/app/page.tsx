import Header from "@/components/Header";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <p className="text-gray-500">
              Welcome to Footy - Your Football Hub
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
