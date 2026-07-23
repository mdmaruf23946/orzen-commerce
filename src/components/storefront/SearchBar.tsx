import { Search, X } from "lucide-react";
import { useStoreUI } from "@/lib/store-ui";

export function SearchBar({ className = "" }: { className?: string }) {
  const { query, setQuery } = useStoreUI();
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products…"
        className="h-10 w-full rounded-full border border-neutral-200 bg-white pl-9 pr-9 text-sm shadow-sm outline-none transition-shadow focus:border-neutral-300 focus:ring-2 focus:ring-neutral-900/5"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
