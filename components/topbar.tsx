import { Search } from "lucide-react";

export function Topbar({ title }: { title: string }) {
  return (
    <div className="sticky top-16 z-20 flex h-14 items-center gap-4 border-b border-neutral-200 bg-neutral-50/85 px-8 backdrop-blur">
      <h1 className="text-lg font-semibold uppercase tracking-wide">{title}</h1>
      <div className="relative ml-auto hidden sm:block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        <input
          placeholder="Buscar…"
          className="h-9 w-56 rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}
