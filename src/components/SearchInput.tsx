import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SearchInput() {
  return (
    <div className="relative w-full sm:w-[300px] min-w-[150px] mx-4">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        type="search"
        placeholder="Search..."
        className="pl-10 focus-visible:ring-green-600/50"
      />
    </div>
  );
}
