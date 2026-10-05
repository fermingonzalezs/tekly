"use client";

import { cn } from "@/lib/utils";

export type BarRow = { label: string; value: number };

/** Ranking de barras horizontales (variante "ranking" de CLAUDE.md): pista
 * lisa `bg-neutral-100`, relleno `CHART_ACCENT`, sin límite de colores. */
export function BarRows({
  rows,
  fmt,
  suffix,
  className,
  compact = false,
}: {
  rows: BarRow[];
  fmt?: (n: number) => string;
  /** Texto extra a la derecha del valor (ej. operaciones). */
  suffix?: (r: BarRow) => string | null;
  className?: string;
  /** Filas más juntas (sin margen superior, `space-y-2`, barra de 6 px) para
   * entrar en una `GraficoCard` de altura fija: con el espaciado normal solo
   * caben 4 filas en esas tarjetas (5 o más se cortan o pisan el título). */
  compact?: boolean;
}) {
  // El ancho usa |valor| -- un ranking con valores negativos (diferencias de
  // conciliación) igual dibuja la barra; el signo va en el número.
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className={cn(compact ? "space-y-2" : "mt-4 space-y-3", className)}>
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-neutral-600">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {fmt ? fmt(r.value) : r.value}
              {suffix && (
                <span className="ml-2 text-[11px] font-normal text-neutral-500">
                  {suffix(r)}
                </span>
              )}
            </span>
          </div>
          <div className={cn("mt-1 rounded-full bg-neutral-100", compact ? "h-1.5" : "h-2")}>
            <div
              className={cn(
                "w-full origin-left rounded-full bg-accent transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]",
                compact ? "h-1.5" : "h-2",
              )}
              style={{ transform: `scaleX(${Math.abs(r.value) / max})` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Barras verticales de altura = % de un contenedor de alto fijo (como
 * `TrendChart`), para que escalen con la card en vez de tener px fijos. */
export function BarColumns({
  rows,
  fmt,
  height = "h-40",
}: {
  rows: BarRow[];
  fmt?: (n: number) => string;
  height?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={cn("mt-5 flex items-end gap-3", height)}>
      {rows.map((r) => (
        <div key={r.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <span className="text-[11px] font-medium text-neutral-500">
            {r.value > 0 && fmt ? fmt(r.value) : r.value > 0 ? r.value : ""}
          </span>
          <div
            className="w-full rounded-t-xl bg-accent"
            style={{ height: `${Math.max(3, (r.value / max) * 100)}%` }}
          />
          <span className="w-full truncate text-center text-xs text-neutral-500">
            {r.label}
          </span>
        </div>
      ))}
    </div>
  );
}
