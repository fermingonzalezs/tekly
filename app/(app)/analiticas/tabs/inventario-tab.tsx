"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { StatCard } from "@/components/ui/stat-card";
import { fmtUsd } from "@/lib/format";
import { AgingRing } from "@/components/analiticas/aging-ring";
import { StockQuadrant } from "@/components/analiticas/stock-quadrant";
import { StockHeatmap } from "@/components/analiticas/stock-heatmap";
import { InventarioFlow } from "@/components/analiticas/inventario-flow";
import { PeriodoChip } from "@/components/analiticas/periodo-chip";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { InventarioValor } from "@/components/inventario-valor";
import { atencionInventario, type ResumenInventario } from "@/lib/analiticas-resumen";
import { CAT_STOCK_LABEL, type StockCategoria } from "@/lib/analiticas";

export function InventarioTab({ resumen }: { resumen: ResumenInventario }) {
  const [celdaStock, setCeldaStock] = useState<{
    rango: string;
    categoria: StockCategoria;
  } | null>(null);
  const atencion = atencionInventario(resumen.stockTodos, celdaStock);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Valor a costo"
          value={fmtUsd(resumen.valorInventario)}
          hint="foto del stock actual"
        />
        <StatCard
          label="Unidades"
          value={resumen.unidadesStock}
          hint="equipos + repuestos + accesorios"
        />
        <StatCard
          label="Días de inventario"
          value={resumen.diasInventario ?? "—"}
          hint="promedio ingreso → venta, equipos"
        />
        <StatCard
          label="Capital inmovilizado"
          value={fmtUsd(resumen.inmovilizado)}
          hint={`${resumen.pctInmovilizado.toFixed(0)}% del valor · más de 90 días`}
          valueClassName={resumen.inmovilizado > 0 ? "text-amber-600" : undefined}
        />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <AgingRing buckets={resumen.aging} />
        <InventarioValor
          equipos={resumen.equipos}
          repuestos={resumen.repuestos}
          otros={resumen.otros}
        />
      </div>

      <Card className="p-5">
        <ChartTitle
          align="left"
          divider
          sub={<>foto del stock actual <PeriodoChip>Estado actual</PeriodoChip></>}
        >
          Unidades por categoría
        </ChartTitle>
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <DonutChart slices={resumen.unidadesSlices} legend="row" />
        </div>
      </Card>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <StockQuadrant
          itemsTodos={resumen.stockTodos}
          items={resumen.stockTodos}
          salidas={resumen.salidas}
        />
        <StockHeatmap buckets={resumen.aging} seleccion={celdaStock} onSeleccion={setCeldaStock} />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <InventarioFlow
          entradas={resumen.entradas}
          salidas={resumen.salidas}
          stock={resumen.stockPorCat}
          bajas={resumen.bajas}
        />

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <ChartTitle
              align="left"
              divider
              sub={<>más de 90 días en stock, por valor <PeriodoChip>Estado actual</PeriodoChip></>}
            >
              Stock que pide atención
            </ChartTitle>
            <ButtonLink
              href="/inventario"
              variant="tonal"
              size="sm"
            >
              Ver inventario
            </ButtonLink>
          </div>
          {celdaStock && (
            <p className="mt-2 text-[11px] text-neutral-500">
              Filtrado: {celdaStock.rango} días · {CAT_STOCK_LABEL[celdaStock.categoria]}{" "}
              <button
                onClick={() => setCeldaStock(null)}
                className="font-medium text-accent underline underline-offset-2"
              >
                quitar
              </button>
            </p>
          )}
          {atencion.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
              Nada trabado más de 90 días -- el stock rota.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
              {atencion.map((i) => (
                <li
                  key={`${i.categoria}:${i.id}`}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-800">{i.nombre}</p>
                    <p className="text-[11px] text-neutral-500">
                      {CAT_STOCK_LABEL[i.categoria]} · {i.unidades} u
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        Días
                      </p>
                      <p className="tabular-nums font-medium text-red-500">{i.dias}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        Valor
                      </p>
                      <p className="tabular-nums font-medium text-neutral-800">
                        {fmtUsd(i.valorUsd)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
