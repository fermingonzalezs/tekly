"use client";

import { motion } from "framer-motion";
import { MockupChrome } from "./mockup-chrome";
import { useReducedMotionSafe } from "./use-reduced-motion";

/**
 * Ilustración de /analiticas para el carousel de módulos: StatCards +
 * "Margen por tipo" con las mismas 4 categorías y paleta monocromática
 * índigo (`CHART_COLORS`, `lib/chart.ts`) que el gráfico real
 * (`lib/analiticas.ts` → `margenPorTipo`) -- las barras crecen desde la
 * base una sola vez cuando el slide entra en pantalla (`animate`, no
 * `whileInView`: el carousel monta/desmonta el slide activo, así que cada
 * vez que vuelve a mostrarse crece de nuevo). Con `prefers-reduced-motion`
 * las barras salen directo a su altura final. Analíticas vive dentro de
 * "Finanzas" en el topnav real, igual que Cajas.
 */

const BARRAS = [
  { label: "Equipos", pct: 48, color: "var(--chart-1)" },
  { label: "Reparaciones", pct: 30, color: "var(--chart-2)" },
  { label: "Accesorios", pct: 14, color: "var(--chart-3)" },
  { label: "Otros", pct: 8, color: "var(--chart-4)" },
];

const STATS = [
  { label: "Facturado del mes", valor: "U$ 48.250", hint: "+12% vs mes previo" },
  { label: "Margen promedio", valor: "34%", hint: "sobre costo" },
  { label: "Ticket promedio", valor: "U$ 410", hint: "este mes" },
];

export function MockupAnaliticas({ className }: { className?: string }) {
  const reduced = useReducedMotionSafe();

  return (
    <div
      className={`flex aspect-video flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-accent/10 ${className ?? ""}`}
      aria-hidden="true"
    >
      <MockupChrome activo="Finanzas" />

      <div className="grid grid-cols-3 gap-1.5 px-3 py-2">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-md border border-neutral-200 p-1.5">
            <p className="truncate text-[5px] font-semibold uppercase tracking-wide text-neutral-400">
              {s.label}
            </p>
            <p className="font-grotesk text-[7px] font-bold tabular-nums text-neutral-900">
              {s.valor}
            </p>
            <p className="truncate text-[5px] text-emerald-600">{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-neutral-100 px-3 pt-2 pb-3">
        <p className="border-b border-neutral-100 pb-1.5 text-[5.5px] font-semibold uppercase tracking-wider text-neutral-500">
          Margen por tipo
        </p>

        <div className="mt-2 flex min-h-0 flex-1 items-end justify-end gap-5 pl-2 pr-8">
          {BARRAS.map((b) => (
            <div key={b.label} className="flex h-full flex-col items-center justify-end">
              <span className="mb-1 font-grotesk text-[6px] font-bold tabular-nums text-neutral-900">
                {b.pct}%
              </span>
              <div className="flex h-full w-5 items-end overflow-hidden rounded-t-md bg-accent-soft">
                <motion.div
                  className="w-full rounded-t-md"
                  style={{ backgroundColor: b.color }}
                  initial={reduced ? undefined : { height: 0 }}
                  animate={{ height: `${b.pct * 1.8}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-end gap-2.5 pr-8">
          {BARRAS.map((b) => (
            <span key={b.label} className="flex items-center gap-1 text-[5px] font-medium text-neutral-600">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: b.color }} />
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
