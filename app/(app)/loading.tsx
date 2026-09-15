import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main className="grid min-h-[60vh] place-items-center p-8">
      <div className="flex flex-col items-center gap-3 text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <p className="text-sm">Cargando…</p>
      </div>
    </main>
  );
}
