export default function Sidebar() {
  return (
    <aside className="w-full md:w-64 bg-white shadow rounded-lg p-4 mb-6 md:mb-0 min-h-[400px] max-h-[600px] overflow-y-auto">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Leagues</h2>
      <div className="border-2 border-dashed border-gray-200 rounded-lg min-h-[200px] p-4 flex items-center justify-center">
        <p className="text-gray-500">Här kommer ligor att visas</p>
      </div>
    </aside>
  );
}
