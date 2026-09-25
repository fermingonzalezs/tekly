"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { chartColor } from "@/lib/chart";
import { fmtUsd } from "@/lib/format";
import { agingBuckets, type AgingCelda } from "@/lib/analiticas";

/** Semáforo de antigüedad: qué tan "trabado" está el stock. Los rangos
 * van del tono más claro de la paleta al más oscuro; "180+" en rojo -- es
 * el capital más viejo, el que pide decisión (liquidar, rebajar). Click
 * en un segmento (o su chip) para ver unidades, valor y % del stock. */
export function AgingRing({ buckets }: { buckets: ReturnType<typeof agingBuckets> }) {
  const [sel, setSel] = useState<number | null>(null);

  const totalUnidades = buckets.reduce((a, b) => a + b.total.unidades, 0);
  const totalValor = buckets.reduce((a, b) => a + b.total.valor, 0);

  // mismo color por rango en el anillo y en los chips
  const colorDe = (i: number) => (i === 4 ? "#ef4444" : chartColor(4 - i));

  const detalle = (c: AgingCelda, rango: string) => {
    const pct = totalUnidades > 0 ? (c.unidades / totalUnidades) * 100 : 0;
    return `${rango} días: ${c.unidades} u · ${fmtUsd(c.valor)} · ${pct.toFixed(0)}% del stock · ${c.productos} productos`;
  };

  const activo = sel != null ? buckets[sel] : null;

  return (
    <Card className="p-5">
      <ChartTitle align="left" divider sub="unidades por antigüedad · desde el ingreso a stock">
        Antigüedad del stock
      </ChartTitle>
      {totalUnidades === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin registros de ingreso para medir la antigüedad -- los ítems anteriores a los
          movimientos de stock no tienen fecha.
        </p>
      ) : (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <div className="relative mx-auto aspect-square max-w-[240px]">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r="48"
                fill="none"
                stroke="var(--accent-soft)"
                strokeWidth="14"
              />
              {(() => {
                let acum = 0;
                return buckets.map((b, i) => {
                  if (b.total.unidades === 0) return null;
                  const pct = (b.total.unidades / totalUnidades) * 100;
                  const offset = -acum;
                  acum += pct;
                  return (
                    <circle
                      key={b.rango}
                      cx="60"
                      cy="60"
                      r="48"
                      fill="none"
                      stroke={colorDe(i)}
                      strokeWidth={sel === i ? 18 : 14}
                      pathLength={100}
                      strokeDasharray={`${Math.max(pct - 0.6, 0.5)} ${100 - pct + 0.6}`}
                      strokeDashoffset={offset}
                      className="cursor-pointer transition-[stroke-width]"
                      onClick={() => setSel(sel === i ? null : i)}
                    >
                      <title>{detalle(b.total, b.rango)}</title>
                    </circle>
                  );
                });
              })()}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-grotesk text-2xl font-semibold tabular-nums text-neutral-900">
                {activo ? activo.total.unidades : totalUnidades}
              </span>
              <span className="text-[11px] text-neutral-400">
                {activo ? activo.rango + " días" : "unidades en stock"}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {buckets.map((b, i) => (
              <button
                key={b.rango}
                onClick={() => setSel(sel === i ? null : i)}
                title={detalle(b.total, b.rango)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors",
                  sel === i
                    ? "border-neutral-400 bg-neutral-50 text-neutral-900"
                    : "border-neutral-200 text-neutral-500 hover:border-neutral-300",
                  b.total.unidades === 0 && "opacity-40",
                )}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: colorDe(i) }}
                />
                {b.rango}
                <span className="text-neutral-400">{b.total.unidades}u</span>
              </button>
            ))}
          </div>

          {activo && (
            <p className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
              {detalle(activo.total, activo.rango)} · valor total del stock {fmtUsd(totalValor)}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
