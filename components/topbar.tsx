import { Search, Bell } from "lucide-react";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-neutral-200 bg-neutral-50/80 px-8 backdrop-blur">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="ml-auto flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <input
            placeholder="Buscar…"
            className="h-9 w-56 rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <button className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50">
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white py-1 pl-1 pr-3">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-semibold text-white">
            FG
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium">Fermín G.</p>
            <p className="text-[10px] text-neutral-400">Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}
