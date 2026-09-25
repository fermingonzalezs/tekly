"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { fmtUsd } from "@/lib/format";
import { STOCK_CATS, CAT_STOCK_LABEL, type StockCategoria } from "@/lib/analiticas";

/** Entrada/stock/salida, verde-índigo-rojo -- mismo criterio que
 * `FlujoCaja` (ingresos verde, egresos rojo): el color identifica la
 * ETAPA, no la categoría (que ya está en el label de la fila), así entrada
 * vs salida se lee de un vistazo en cualquier categoría. */
const ETAPA_COLOR = { entrada: "#10b981", stock: "var(--accent)", salida: "#f87171" } as const;

/** Flujo de unidades de la pestaña Inventario: entradas del período → foto
 * actual del stock → salidas del período, una fila por categoría. Barras
 * agrupadas con UNA sola escala compartida entre las tres etapas (antes
 * cada columna tenía su propio máximo -- comparar entrada vs stock vs
 * salida de un vistazo no funcionaba con barras de 1.5px de alto escaladas
 * cada una contra un máximo distinto). No es un Sankey contable y no
 * pretende serlo: las entradas/salidas del período no tienen por qué
 * cuadrar con el stock actual (quedó lo que entró antes, salió lo que
 * entró antes). Las bajas no registran unidades -- se cuentan como ítems
 * al pie. */
export function InventarioFlow({
  entradas,
  salidas,
  stock,
  bajas,
}: {
  /** Unidades ingresadas en el período filtrado, por categoría. */
  entradas: Record<StockCategoria, number>;
  /** Unidades que salieron en el período filtrado, por categoría. */
  salidas: Record<StockCategoria, number>;
  /** Foto actual por categoría. */
  stock: Record<StockCategoria, { unidades: number; valor: number }>;
  /** Ítems dados de baja en el período (sin unidades registradas). */
  bajas: number;
}) {
  const conMovimiento =
    STOCK_CATS.some((c) => entradas[c] > 0 || salidas[c] > 0) || bajas > 0;

  // una sola escala para las 3 etapas de las 3 categorías -- comparable
  // entre sí, a diferencia de la versión anterior (un máximo por columna)
  const maxTodo = Math.max(
    1,
    ...STOCK_CATS.flatMap((c) => [entradas[c], stock[c].unidades, salidas[c]]),
  );
  const ALTO = 72; // px

  const Barra = ({ v, color, label }: { v: number; color: string; label: string }) => (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-[72px] w-6 items-end">
        <div
          className="w-full rounded-t-md"
          style={{ height: `${Math.max(v > 0 ? 3 : 0, (v / maxTodo) * ALTO)}px`, background: color }}
        />
      </div>
      <span className="text-[10px] font-semibold tabular-nums text-neutral-600">{v}</span>
      <span className="text-[9px] uppercase tracking-wide text-neutral-400">{label}</span>
    </div>
  );

  return (
    <Card className="p-5">
      <ChartTitle
        align="left"
        divider
        sub="unidades · entradas y salidas del período filtrado · el stock es la foto actual, no cuadra con el flujo"
      >
        Flujo del inventario
      </ChartTitle>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: ETAPA_COLOR.entrada }} />
          Entradas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: ETAPA_COLOR.stock }} />
          Stock actual
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: ETAPA_COLOR.salida }} />
          Salidas
        </span>
      </div>

      <div className="mt-4 flex flex-wrap justify-around gap-6 sm:justify-between">
        {STOCK_CATS.map((c) => (
          <div key={c} className="flex flex-col items-center gap-2">
            <div
              className="flex items-end gap-2"
              title={`${CAT_STOCK_LABEL[c]}: +${entradas[c]} u entraron, ${stock[c].unidades} u en stock (${fmtUsd(stock[c].valor)} a costo), −${salidas[c]} u salieron en el período`}
            >
              <Barra v={entradas[c]} color={ETAPA_COLOR.entrada} label="Entra" />
              <Barra v={stock[c].unidades} color={ETAPA_COLOR.stock} label="Stock" />
              <Barra v={salidas[c]} color={ETAPA_COLOR.salida} label="Sale" />
            </div>
            <p className="text-xs font-medium text-neutral-600">{CAT_STOCK_LABEL[c]}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-[11px] text-neutral-400">
        <span>
          Las salidas son ventas (equipos/otros) y repuestos usados en ventas y
          reparaciones.
        </span>
        {bajas > 0 && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-500">
            {bajas} ítem{bajas === 1 ? "" : "s"} dado{bajas === 1 ? "" : "s"} de baja
          </span>
        )}
        {!conMovimiento && (
          <span className="text-neutral-400">Sin movimientos en el período filtrado.</span>
        )}
      </div>
    </Card>
  );
}
