"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { ArticuloMeta } from "@/lib/ayuda";

/** Buscador del centro de ayuda: filtra el índice (título, resumen y cuerpo
 * ya resumido) en el cliente, sin servicio externo. El índice lo pasa el
 * server component. */
export function BuscadorAyuda({ indice }: { indice: ArticuloMeta[] }) {
  const [q, setQ] = useState("");

  const resultados = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return indice
      .map((a) => {
        const enTitulo = a.titulo.toLowerCase().includes(needle) ? 2 : 0;
        const enResumen = a.resumen.toLowerCase().includes(needle) ? 1 : 0;
        return { a, score: enTitulo + enResumen };
      })
      .filter(({ score }) => score > 0)
      .sort((x, y) => y.score - x.score || x.a.titulo.localeCompare(y.a.titulo))
      .slice(0, 8)
      .map(({ a }) => a);
  }, [q, indice]);

  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar en la ayuda… (ej. canje, conciliar)"
        aria-label="Buscar en el centro de ayuda"
        className="h-12 w-full rounded-full border border-neutral-900/10 bg-white pl-11 pr-4 text-sm shadow-sm outline-none focus:border-accent"
      />
      {q.trim() && (
        <div className="animate-fade-in absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
          {resultados.length === 0 ? (
            <p className="px-4 py-3 text-sm text-neutral-500">
              Sin resultados para «{q.trim()}».
            </p>
          ) : (
            <ul>
              {resultados.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.url}
                    className="block px-4 py-2.5 transition-colors hover:bg-neutral-50"
                  >
                    <p className="text-sm font-semibold text-neutral-900">{a.titulo}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{a.resumen}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
