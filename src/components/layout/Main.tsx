export default function Main() {
  return (
    <main className="flex-1 bg-green-800 shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6 h-full">
        <h2 className="text-xl font-semibold text-white mb-4">Fixtures</h2>
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 overflow-auto max-h-[calc(100vh-112px)]">
          <p className="text-white">Här kommer kommande matcher att visas</p>
        </div>
      </div>
    </main>
  );
}

