"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/format";
import type { MargenPorTipo } from "@/lib/analiticas";

/** Waterfall de resultado: cómo se pasa de la facturación (con costo
 * cargado, misma base que `margenPorTipo`) a la ganancia, restando el
 * costo de cada rubro. Rubros sin costo quedan afuera del puente: no hay
 * costo que restar y meterlos inventaría un salto. Las guías punteadas
 * marcan el nivel entre una barra y la siguiente. */
export function WaterfallResultado({
  rows,
  className,
}: {
  rows: MargenPorTipo[];
  className?: string;
}) {
  const ingresos = rows.reduce((a, r) => a + r.facturacionUsd, 0);
  const ganancia = rows.reduce((a, r) => a + r.gananciaUsd, 0);
  const costos = rows
    .map((r) => ({ tipo: r.tipo, costo: r.facturacionUsd - r.gananciaUsd }))
    .filter((c) => c.costo > 0);

  // columnas: Ingresos, un costo por rubro, Ganancia
  let nivel = ingresos;
  type Col = {
    label: string;
    desde: number;
    hasta: number;
    kind: "ingreso" | "costo" | "ganancia";
  };
  const cols: Col[] = [
    { label: "Ingresos", desde: 0, hasta: ingresos, kind: "ingreso" },
    ...costos.map((c) => {
      const col: Col = {
        label: `Costo ${c.tipo.toLowerCase()}`,
        desde: nivel - c.costo,
        hasta: nivel,
        kind: "costo",
      };
      nivel -= c.costo;
      return col;
    }),
    { label: "Ganancia", desde: 0, hasta: ganancia, kind: "ganancia" },
  ];

  // Escala real: no asumir [0, ingresos] -- un rubro que da pérdida (costo
  // mayor a su propia facturación, posible con precios/costos cargados a
  // mano) hunde el nivel intermedio por debajo de 0, y ahí una barra con
  // % negativo se renderiza fuera de la card. `HEADROOM` reserva aire
  // arriba para el label de valor -- la barra de "Ingresos" siempre toca
  // el techo de la escala, y sin este margen ese label queda flotando
  // afuera del borde de la card en vez de adentro.
  const valores = cols.flatMap((c) => [c.desde, c.hasta]);
  const minV = Math.min(0, ...valores);
  const maxV = Math.max(ingresos, ...valores);
  const rango = maxV - minV || 1;
  const HEADROOM = 14;
  const pct = (v: number) => ((v - minV) / rango) * (100 - HEADROOM);

  return (
    <Card className={cn("p-5", className)}>
      <ChartTitle align="left" divider sub="de la facturación a la ganancia, costo por rubro">
        Waterfall de resultado
      </ChartTitle>
      {ingresos <= 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin ventas con costo cargado en el período filtrado.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[420px]">
            {/* guías de nivel: quedan tapadas por las barras y visibles en
                los huecos, como conectores del waterfall */}
            <div className="relative h-44">
              {cols.slice(0, -1).map((c, i) => (
                <div
                  key={`g${i}`}
                  className="absolute inset-x-0 border-t border-dashed border-neutral-300"
                  style={{ bottom: `${pct(c.hasta)}%` }}
                />
              ))}
              <div className="flex h-full items-stretch gap-3">
                {cols.map((c) => {
                  const color =
                    c.kind === "ingreso"
                      ? "bg-accent"
                      : c.kind === "costo"
                        ? "bg-red-400"
                        : "bg-emerald-500";
                  const signo = c.kind === "costo" ? "−" : "";
                  return (
                    <div key={c.label} className="relative min-w-0 flex-1">
                      <span
                        className="absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums"
                        style={{ bottom: `calc(${pct(c.hasta)}% + 2px)` }}
                      >
                        {signo}
                        {fmtUsd(c.hasta - c.desde)}
                      </span>
                      <div
                        className={cn("absolute inset-x-0 rounded-md", color)}
                        style={{
                          bottom: `${pct(c.desde)}%`,
                          height: `${pct(c.hasta) - pct(c.desde)}%`,
                        }}
                        title={`${c.label}: ${fmtUsd(c.hasta - c.desde)}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-1 flex gap-3">
              {cols.map((c) => (
                <span
                  key={c.label}
                  className="min-w-0 flex-1 truncate text-center text-[10px] text-neutral-500"
                >
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
