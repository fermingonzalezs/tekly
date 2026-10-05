"use client";

import { GraficoCard } from "@/components/ui/grafico-card";
import {
  BarColumns,
  BarRows,
  type BarRow,
} from "@/app/(app)/analiticas/bar-rows";
import { DonutChart, type DonutSlice } from "@/components/dashboard/donut-chart";
import { chartColor } from "@/lib/chart";

/** Filas de ranking que entran en una `GraficoCard` (288 px) con `BarRows
 * compact`: ~30 px por fila + 8 px de separación, sobre ~187 px de cuerpo. */
const MAX_FILAS_RANKING = 5;

function Vacio({ texto }: { texto?: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
      {texto ?? "Sin datos en el período."}
    </p>
  );
}

/** Barras verticales (una serie) dentro del contenedor estándar. */
export function GraficoBarrasVerticales({
  title,
  sub,
  rows,
  fmt,
  vacio,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  rows: BarRow[];
  fmt?: (n: number) => string;
  vacio?: string;
}) {
  return (
    <GraficoCard title={title} sub={sub}>
      {rows.length === 0 ? (
        <Vacio texto={vacio} />
      ) : (
        <BarColumns rows={rows} fmt={fmt} height="h-44" />
      )}
    </GraficoCard>
  );
}

/** Ranking de barras horizontales dentro del contenedor estándar. El ancho
 *  de la barra usa el valor absoluto, así un ranking con valores negativos
 *  (ej. diferencias de conciliación) sigue dibujando bien; `suffix` permite
 *  mostrar el signo/la moneda real al lado del valor. */
export function GraficoRanking({
  title,
  sub,
  rows,
  fmt,
  suffix,
  vacio,
  limite = MAX_FILAS_RANKING,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  rows: BarRow[];
  fmt?: (n: number) => string;
  suffix?: (r: BarRow) => string | null;
  vacio?: string;
  /** Máximo de filas que se dibujan (las primeras): la `GraficoCard` mide
   * 288 px fijos, y con filas compactas entran 5 (ver `MAX_FILAS_RANKING`). */
  limite?: number;
}) {
  return (
    <GraficoCard title={title} sub={sub}>
      {rows.length === 0 ? (
        <Vacio texto={vacio} />
      ) : (
        // `min-h-0 overflow-y-auto`: si una fila de más se cuela, la lista
        // scrollea dentro de su cuerpo en vez de pisar el título de la card.
        <div className="min-h-0 overflow-y-auto">
          <BarRows rows={rows.slice(0, limite)} fmt={fmt} suffix={suffix} compact />
        </div>
      )}
    </GraficoCard>
  );
}

/** Dona monocromática; calcula `pct` y leyenda a partir de los valores. */
export function GraficoDona({
  title,
  sub,
  data,
  legend = "list",
  fmtValor,
  vacio,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  data: { label: string; value: number }[];
  legend?: "list" | "row";
  fmtValor?: (n: number) => string;
  vacio?: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const slices: DonutSlice[] = data.map((d, i) => ({
    label: d.label,
    pct: total > 0 ? Math.round((d.value / total) * 100) : 0,
    color: chartColor(i),
    valueLabel: fmtValor ? fmtValor(d.value) : String(d.value),
  }));
  return (
    <GraficoCard title={title} sub={sub}>
      {total === 0 ? (
        <Vacio texto={vacio} />
      ) : (
        <DonutChart slices={slices} legend={legend} />
      )}
    </GraficoCard>
  );
}

/** Barras agrupadas (2+ series por etiqueta): ingresos vs egresos, cargos vs
 *  pagos, etc. Sin límite de categorías; colores de la paleta por serie. */
export function GraficoBarrasAgrupadas({
  title,
  sub,
  labels,
  series,
  fmt,
  vacio,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  labels: string[];
  series: { name: string; values: number[]; color?: string }[];
  fmt?: (n: number) => string;
  vacio?: string;
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return (
    <GraficoCard title={title} sub={sub}>
      {labels.length === 0 ? (
        <Vacio texto={vacio} />
      ) : (
        <>
          <div className="flex min-h-0 flex-1 items-end gap-2">
            {labels.map((label, i) => (
              <div
                key={label}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              >
                <div className="flex h-full w-full items-end justify-center gap-0.5">
                  {series.map((s, j) => (
                    <div
                      key={s.name}
                      className="w-full max-w-[14px] self-end rounded-t-md"
                      style={{
                        height: `${Math.max(2, ((s.values[i] ?? 0) / max) * 100)}%`,
                        background: s.color ?? chartColor(j),
                      }}
                      title={`${s.name}: ${
                        fmt ? fmt(s.values[i] ?? 0) : (s.values[i] ?? 0)
                      }`}
                    />
                  ))}
                </div>
                <span className="w-full truncate text-center text-[10px] text-neutral-500">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px]">
            {series.map((s, j) => (
              <span key={s.name} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: s.color ?? chartColor(j) }}
                />
                <span className="text-neutral-600">{s.name}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </GraficoCard>
  );
}
