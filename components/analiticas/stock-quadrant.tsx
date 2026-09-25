"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { chartColor } from "@/lib/chart";
import { fmtUsd } from "@/lib/format";
import {
  STOCK_CATS,
  CAT_STOCK_LABEL,
  type StockCategoria,
  type StockItem,
} from "@/lib/analiticas";

/** Cuántos ítems de producto mostrar -- el criterio del mapa de stock:
 * los chicos en valor son ruido, y se informa cuántos quedaron afuera. */
const MAX_PRODUCTOS = 40;

type Punto = {
  nombre: string;
  categoria: StockCategoria;
  x: number; // rotación: veces que salió el stock del período (categoría)
  y: number; // valor a costo
  unidades: number;
  salidas?: number;
};

/** Matiz de acción sobre el stock: rotación (veces que el stock del
 * período salió a venta/reparación) contra valor atado a costo. Vista por
 * categoría (foto global) o por producto (respecta el filtro de
 * categoría; X pasa a días en stock, su inversa: la rotación por producto
 * no es medible -- cada equipo se vende una sola vez y los repuestos
 * usados no se rastrean por ítem de venta). */
export function StockQuadrant({
  itemsTodos,
  items,
  salidas,
}: {
  /** Sin filtro de categoría -- la vista por categoría necesita las 3. */
  itemsTodos: StockItem[];
  /** Ya filtrados por la categoría activa (solo vista por producto). */
  items: StockItem[];
  /** Unidades que salieron del stock en el período filtrado, por
   * categoría (vendidos + usados en ventas y reparaciones). */
  salidas: Record<StockCategoria, number>;
}) {
  const [vista, setVista] = useState<"categoria" | "producto">("categoria");
  const colorDe = (c: StockCategoria) => chartColor(STOCK_CATS.indexOf(c));

  const puntosCategoria: Punto[] = STOCK_CATS.map((c) => {
    const propios = itemsTodos.filter((i) => i.categoria === c);
    const unidades = propios.reduce((a, i) => a + i.unidades, 0);
    return {
      nombre: CAT_STOCK_LABEL[c],
      categoria: c,
      x: unidades > 0 ? salidas[c] / unidades : 0,
      y: propios.reduce((a, i) => a + i.valorUsd, 0),
      unidades,
      salidas: salidas[c],
    };
  }).filter((p) => p.unidades > 0 || p.y > 0);

  const conDias = items.filter((i) => i.dias != null && i.valorUsd > 0);
  const puntosProducto: Punto[] = [...conDias]
    .sort((a, b) => b.valorUsd - a.valorUsd)
    .slice(0, MAX_PRODUCTOS)
    .map((i) => ({
      nombre: i.nombre,
      categoria: i.categoria,
      x: i.dias as number,
      y: i.valorUsd,
      unidades: i.unidades,
    }));
  const ocultosProducto = conDias.length - puntosProducto.length;

  const puntos = vista === "categoria" ? puntosCategoria : puntosProducto;
  const ocultos = vista === "categoria" ? 0 : ocultosProducto;

  const maxX = Math.max(vista === "categoria" ? 1 : 30, ...puntos.map((p) => p.x));
  const maxY = Math.max(1, ...puntos.map((p) => p.y));
  const maxUnidades = Math.max(1, ...puntos.map((p) => p.unidades));

  // mediana de X e Y entre los puntos ploteados: dividen los 4 cuadrantes
  const mediana = (xs: number[]) => {
    const o = [...xs].sort((a, b) => a - b);
    return o.length ? o[Math.floor((o.length - 1) / 2)] : 0;
  };
  const xMed = mediana(puntos.map((p) => p.x));
  const yMed = mediana(puntos.map((p) => p.y));

  const xToPct = (v: number) => 8 + (v / maxX) * 84;
  // Más aire arriba que en el resto de los scatter de la app (20% en vez
  // de 16%): acá además del punto hay un label de texto encima en la
  // vista "categoria", necesita más lugar para no salirse de la card.
  const yToPct = (v: number) => 8 + (v / maxY) * 70;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <ChartTitle
          align="left"
          divider
          sub={
            vista === "categoria"
              ? "X: rotación del período (salidas / stock) · Y: valor a costo · tamaño: unidades"
              : "X: días en stock (menor = rota más rápido) · Y: valor a costo · tamaño: unidades"
          }
        >
          Rotación vs valor
        </ChartTitle>
        <div className="flex shrink-0 gap-1 pt-0.5">
          {(["categoria", "producto"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium capitalize transition-colors",
                vista === v
                  ? "border-accent/60 bg-accent-soft text-neutral-900"
                  : "border-neutral-200 text-neutral-500 hover:border-neutral-300",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {puntos.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin stock con registro de ingreso{vista === "categoria" ? "" : " en la categoría activa"}.
        </p>
      ) : (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <div className="relative h-56">
            {/* cuadrantes por mediana -- sin texto adentro del área de
                datos: con pocos puntos (sobre todo en "categoria") un punto
                cae justo en la esquina y tapaba el label. La explicación de
                cada cuadrante ahora vive en la leyenda fija de abajo. */}
            <div
              className="absolute inset-y-0 border-l border-dashed border-neutral-200"
              style={{ left: `${xToPct(xMed)}%` }}
            />
            <div
              className="absolute inset-x-0 border-t border-dashed border-neutral-200"
              style={{ bottom: `${yToPct(yMed)}%` }}
            />

            {puntos.map((p) => {
              const d = 14 + Math.round(20 * Math.sqrt(p.unidades / maxUnidades));
              const left = xToPct(p.x);
              const bottom = yToPct(p.y);
              const tooltip =
                vista === "categoria"
                  ? `${p.nombre}: ${p.unidades} u · ${fmtUsd(p.y)} · ${p.salidas ?? 0} salidas del período · rotación ${p.x.toFixed(1)}×`
                  : `${p.nombre} (${CAT_STOCK_LABEL[p.categoria]}): ${p.unidades} u · ${fmtUsd(p.y)} · ${p.x} días en stock`;
              return (
                <div key={`${p.categoria}:${p.nombre}`} className="contents">
                  <span
                    className="absolute -translate-x-1/2 translate-y-1/2 rounded-full opacity-75 ring-2 ring-white"
                    style={{
                      left: `${left}%`,
                      bottom: `${bottom}%`,
                      width: d,
                      height: d,
                      background: colorDe(p.categoria),
                    }}
                    title={tooltip}
                  />
                  {/* Con 3 puntos fijos (vista "categoria") el label directo
                      siempre entra; con hasta 40 (vista "producto") se
                      amontonarían -- ahí la identidad queda en el color +
                      la leyenda de abajo, el nombre completo va al hover. */}
                  {vista === "categoria" && (
                    <span
                      className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-neutral-600"
                      style={{ left: `${left}%`, bottom: `calc(${bottom}% + ${d / 2 + 4}px)` }}
                    >
                      {p.nombre}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {/* eje X con la unidad de la vista activa */}
          <div className="relative mt-1 border-t border-neutral-200 pt-1 text-[10px] tabular-nums text-neutral-400">
            <span className="absolute left-0">
              0 {vista === "categoria" ? "×" : "días"}
            </span>
            <span className="absolute right-0">
              {vista === "categoria"
                ? `${maxX.toFixed(1)} × rotación`
                : `${Math.round(maxX)} días`}
            </span>
            <span className="sr-only">rotación</span>
          </div>

          {vista === "producto" && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-neutral-500">
              {STOCK_CATS.filter((c) => puntos.some((p) => p.categoria === c)).map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: colorDe(c) }}
                  />
                  {CAT_STOCK_LABEL[c]}
                </span>
              ))}
            </div>
          )}

          <p className="mt-3 border-t border-neutral-100 pt-2 text-[10px] leading-relaxed text-neutral-400">
            Arriba-izq: productos clave · arriba-der: capital inmovilizado ·
            abajo-izq: movimiento rápido · abajo-der: stock secundario
            (líneas punteadas = mediana).
          </p>

          {ocultos > 0 && (
            <p className="mt-2 text-[11px] text-neutral-400">
              +{ocultos} ítems de menor valor no mostrados
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
