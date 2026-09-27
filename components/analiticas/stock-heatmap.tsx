"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { heatCell } from "@/lib/chart";
import { fmtUsd } from "@/lib/format";
import {
  AGING_RANGOS,
  STOCK_CATS,
  CAT_STOCK_LABEL,
  type StockCategoria,
  type AgingCelda,
  type agingBuckets,
} from "@/lib/analiticas";

/** Dónde está el dinero atado según antigüedad × categoría: el color es
 * el VALOR a costo (no unidades -- el heatmap de actividad ya cuenta
 * unidades; acá lo que importa es el capital). Click en una celda filtra
 * "Stock que pide atención" de abajo. */
export function StockHeatmap({
  buckets,
  seleccion,
  onSeleccion,
}: {
  buckets: ReturnType<typeof agingBuckets>;
  seleccion: { rango: string; categoria: StockCategoria } | null;
  onSeleccion: (s: { rango: string; categoria: StockCategoria } | null) => void;
}) {
  const maxValor = Math.max(
    0,
    ...buckets.flatMap((b) => [
      ...STOCK_CATS.map((c) => b.porCategoria[c].valor),
      b.total.valor,
    ]),
  );

  const celda = (
    c: AgingCelda,
    rango: string,
    categoria: StockCategoria | "total",
    activa: boolean,
  ) => {
    const h = heatCell(c.valor, 0, Math.max(1, maxValor));
    const titulo =
      categoria === "total"
        ? `${rango} días (todas): ${c.unidades} u · ${fmtUsd(c.valor)} · ${c.productos} productos`
        : `${rango} días · ${CAT_STOCK_LABEL[categoria]}: ${c.unidades} u · ${fmtUsd(c.valor)} · ${c.productos} productos`;
    const filaVieja = AGING_RANGOS.findIndex((r) => r.rango === rango) >= 3;
    return (
      <button
        key={`${rango}:${categoria}`}
        onClick={() =>
          categoria !== "total" &&
          onSeleccion(
            activa ? null : { rango, categoria },
          )
        }
        title={titulo}
        className={cn(
          "flex h-9 min-w-0 items-center justify-center rounded-lg border border-neutral-100/60 text-[11px] font-medium tabular-nums transition-colors",
          c.unidades === 0 ? "text-neutral-300" : h.dark ? "text-neutral-700" : "text-white",
          categoria !== "total" && "cursor-pointer hover:border-neutral-300",
          categoria !== "total" && c.unidades > 0 && "hover:opacity-90",
          activa && "ring-2 ring-accent ring-offset-1",
          filaVieja && c.unidades > 0 && categoria !== "total" && "underline decoration-red-300 decoration-2 underline-offset-4",
        )}
        style={{ background: h.bg }}
      >
        {c.unidades > 0 ? `${c.unidades}u` : "·"}
      </button>
    );
  };

  return (
    <Card className="p-5">
      <ChartTitle
        align="left"
        divider
        sub="color = valor a costo por antigüedad y categoría · click filtra la lista de abajo"
      >
        Capital por antigüedad
      </ChartTitle>
      {maxValor === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin stock con registro de ingreso -- no hay antigüedad que cruzar.
        </p>
      ) : (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <div className="grid grid-cols-[3.2rem_repeat(4,1fr)] gap-1.5">
            <span />
            {STOCK_CATS.map((c) => (
              <span
                key={c}
                className="text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-400"
              >
                {CAT_STOCK_LABEL[c].slice(0, 4)}
              </span>
            ))}
            <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Total
            </span>

            {buckets.map((b) => (
              <div key={b.rango} className="col-span-5 grid grid-cols-[3.2rem_repeat(4,1fr)] gap-1.5">
                <span
                  className={cn(
                    "flex items-center justify-end pr-1 text-[11px] font-medium tabular-nums",
                    AGING_RANGOS.findIndex((r) => r.rango === b.rango) >= 3
                      ? "text-red-500"
                      : "text-neutral-500",
                  )}
                >
                  {b.rango}
                </span>
                {STOCK_CATS.map((c) =>
                  celda(
                    b.porCategoria[c],
                    b.rango,
                    c,
                    seleccion?.rango === b.rango && seleccion?.categoria === c,
                  ),
                )}
                {celda(b.total, b.rango, "total", false)}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
