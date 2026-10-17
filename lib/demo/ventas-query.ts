/** Consulta en memoria de la sección Ventas de la demo (plan 014, paso 3).
 *
 * Reimplementa, puro y sin Supabase, lo que hace SQL en `lib/db/ventas.ts`:
 * `listVentasPagina` + `listItemsVendidosPagina` + `contarVentas` +
 * `contarItemsVendidos` + `resumenVentas` + `graficosVentas` + `getVenta`.
 * Las reglas de filtro/orden son las mismas -- ver "Ventas" en CLAUDE.md.
 */

import type { Celular, Notebook, Venta, VentaItem } from "@/lib/types";
import type { FiltrosVentas } from "@/lib/ventas-filtros";
import type { Rango } from "@/lib/date-presets";
import { enRango } from "@/lib/date-presets";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  categoriaDe,
  graficosDeVentas,
  resumenDeVentas,
  type GraficosVentas,
  type ResumenVentas,
} from "@/lib/ventas";
import type { DemoState } from "@/lib/demo/seed";

export type ItemVendidoDemo = { venta: Venta; item: VentaItem; serial?: string };

export type ConsultaVentas = {
  ventas: Venta[];
  totalVentas: number;
  items: ItemVendidoDemo[];
  totalItems: number;
  resumen: ResumenVentas;
  resumenAnterior: ResumenVentas | null;
  graficos: GraficosVentas;
  ventaAbierta: Venta | null;
};

function numeroDeVenta(id: string): number {
  return Number(id.replace(/^V-/, ""));
}

function itemCoincide(
  item: VentaItem,
  q: string,
  celulares: Celular[],
  notebooks: Notebook[],
): boolean {
  if (item.detalle.toLowerCase().includes(q)) return true;
  if (item.celularId) {
    const equipo = celulares.find((e) => e.id === item.celularId);
    if (equipo && equipo.imei.toLowerCase().includes(q)) return true;
  }
  if (item.notebookId) {
    const nb = notebooks.find((n) => n.id === item.notebookId);
    if (nb && nb.numeroSerie.toLowerCase().includes(q)) return true;
  }
  return false;
}

/** `q` a nivel venta: número exacto (`V-1002` o `1002`), cliente `ilike`,
 * detalle de algún ítem o IMEI de algún equipo del ítem. */
function ventaCoincide(
  v: Venta,
  q: string,
  celulares: Celular[],
  notebooks: Notebook[],
): boolean {
  if (v.id.toLowerCase() === q) return true;
  if (String(numeroDeVenta(v.id)) === q) return true;
  if (v.cliente.toLowerCase().includes(q)) return true;
  return v.items.some((i) => itemCoincide(i, q, celulares, notebooks));
}

function ventaCoincideClienteNumero(v: Venta, q: string): boolean {
  return (
    v.id.toLowerCase() === q ||
    String(numeroDeVenta(v.id)) === q ||
    v.cliente.toLowerCase().includes(q)
  );
}

/** Filtros comunes a todas las vistas: rango + vendedor + rubro + `q`. */
function filtrarVentas(
  state: DemoState,
  filtros: FiltrosVentas,
  rango: Rango,
): Venta[] {
  const q = filtros.q.toLowerCase();
  return state.ventas.filter(
    (v) =>
      enRango(v.fechaISO, rango) &&
      (!filtros.vendedor || v.vendedorId === filtros.vendedor) &&
      (!filtros.tipo || v.items.some((i) => categoriaDe(i) === filtros.tipo)) &&
      (!q || ventaCoincide(v, q, state.celulares, state.notebooks)),
  );
}

function ordenar(
  ventas: Venta[],
  sort: FiltrosVentas["sort"],
  dir: FiltrosVentas["dir"],
): Venta[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...ventas].sort((a, b) => {
    let cmp: number;
    switch (sort) {
      case "numero":
        cmp = numeroDeVenta(a.id) - numeroDeVenta(b.id);
        break;
      case "total_usd":
        cmp = a.totalUsd - b.totalUsd;
        break;
      case "margen_pct":
        cmp = a.margenPct - b.margenPct;
        break;
      default:
        cmp = a.fechaISO.localeCompare(b.fechaISO);
        break;
    }
    if (cmp === 0) cmp = numeroDeVenta(a.id) - numeroDeVenta(b.id);
    return cmp * sign;
  });
}

function resumenDe(ventas: Venta[]): ResumenVentas {
  return resumenDeVentas(ventas);
}

function graficosDe(ventas: Venta[]): GraficosVentas {
  return graficosDeVentas(
    ventas.map((v) => ({
      // El seed guarda `fechaISO` date-only; `graficosDeVentas` formatea en
      // hora argentina, así que se ancla al mediodía ART para no correr el
      // día (mismo cuidado que el resto de la app con fechas sin hora).
      fechaISO: `${v.fechaISO}T12:00:00-03:00`,
      totalUsd: v.totalUsd,
      rubros: v.items.map((i) => ({
        rubro: categoriaDe(i),
        monto: i.precioUsd * i.cantidad,
      })),
    })),
  );
}

export function consultarVentas(
  state: DemoState,
  filtros: FiltrosVentas,
  rango: Rango,
  rangoAnterior: Rango | null,
  openId?: string | null,
): ConsultaVentas {
  const base = filtrarVentas(state, filtros, rango);
  const ordenadas = ordenar(base, filtros.sort, filtros.dir);

  const from = (filtros.page - 1) * PAGE_SIZE;
  const ventas = ordenadas.slice(from, from + PAGE_SIZE);

  // Ítems vendidos: rango/vendedor a nivel venta, `tipo` y `q` a nivel ítem
  // (mismas reglas que `aplicarFiltrosItems` en lib/db/ventas.ts).
  const q = filtros.q.toLowerCase();
  const ventasBaseItems = state.ventas.filter(
    (v) =>
      enRango(v.fechaISO, rango) &&
      (!filtros.vendedor || v.vendedorId === filtros.vendedor),
  );
  const filas: ItemVendidoDemo[] = [];
  for (const venta of ordenar(ventasBaseItems, filtros.sort, filtros.dir)) {
    const ventaQ = !q || ventaCoincideClienteNumero(venta, q);
    for (const item of venta.items) {
      if (filtros.tipo && categoriaDe(item) !== filtros.tipo) continue;
      if (q && !ventaQ && !itemCoincide(item, q, state.celulares, state.notebooks))
        continue;
      filas.push({
        venta,
        item,
        serial: item.celularId
          ? state.celulares.find((e) => e.id === item.celularId)?.imei
          : item.notebookId
            ? state.notebooks.find((n) => n.id === item.notebookId)?.numeroSerie
            : undefined,
      });
    }
  }
  const items = filas.slice(from, from + PAGE_SIZE);

  const ventaAbierta =
    openId && !ventas.some((v) => v.id === openId)
      ? (state.ventas.find((v) => v.id === openId) ?? null)
      : null;

  return {
    ventas,
    totalVentas: ordenadas.length,
    items,
    totalItems: filas.length,
    resumen: resumenDe(ordenadas),
    resumenAnterior: rangoAnterior
      ? resumenDe(filtrarVentas(state, filtros, rangoAnterior))
      : null,
    graficos: graficosDe(ordenadas),
    ventaAbierta,
  };
}
