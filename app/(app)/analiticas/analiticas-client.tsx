"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { Input, Select } from "@/components/ui/field";
import { DATE_PRESETS, presetRange, type DatePreset } from "@/lib/date-presets";
import { filterPill } from "@/lib/ui-styles";
import {
  margenPorTipo as calcularMargenPorTipo,
  ventasPorDiaSemana,
  ventasBrutasPorFalla,
  funnelTickets,
  tasaAceptacion,
  rentabilidadPorMes,
  stockItems,
  agingBuckets,
  diasInventarioEquipos,
  unidadesDeMovimiento,
  AGING_RANGOS,
  STOCK_CATS,
  CAT_STOCK_LABEL,
  type RubroMes,
  type AntiguedadTickets,
  type StockCategoria,
} from "@/lib/analiticas";
import { RUBRO_LABEL, RUBRO_ORDEN, categoriaDe } from "@/lib/ventas";
import {
  DIAS_ACTIVO,
  DIAS_RIESGO,
  SIN_PROCEDENCIA,
  clientesIntel,
  kpisClientes,
  cohortesClientes,
  flujoClientes,
  procedenciaRanking,
  ingresosPorMesClientes,
} from "@/lib/clientes-inteligencia";
import {
  medioPago as medioPagoCfg,
  categoriaGasto as categoriaGastoCfg,
  turnoTipo,
  turnoStatus,
} from "@/lib/status";
import { fmtUsd } from "@/lib/format";
import { useDolar } from "@/lib/dolar";
import { CHART_ACCENT, chartColor } from "@/lib/chart";
import { cn } from "@/lib/utils";
import { TendenciaRubros } from "@/components/analiticas/tendencia-rubros";
import { Treemap } from "@/components/analiticas/treemap";
import { FunnelReparaciones } from "@/components/analiticas/funnel-reparaciones";
import { GaugeAceptacion } from "@/components/analiticas/gauge-aceptacion";
import { HeatmapActividad } from "@/components/analiticas/heatmap-actividad";
import { RentabilidadEvolucion } from "@/components/analiticas/rentabilidad-linea";
import { WaterfallResultado } from "@/components/analiticas/waterfall-resultado";
import { ScatterMargen } from "@/components/analiticas/scatter-margen";
import { FlujoCaja } from "@/components/analiticas/flujo-caja";
import { AgingRing } from "@/components/analiticas/aging-ring";
import { StockQuadrant } from "@/components/analiticas/stock-quadrant";
import { StockHeatmap } from "@/components/analiticas/stock-heatmap";
import { InventarioFlow } from "@/components/analiticas/inventario-flow";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { InventarioValor } from "@/components/inventario-valor";
import { ValueMap } from "@/components/analiticas/clientes/value-map";
import { ComprasReparacionesMap } from "@/components/analiticas/clientes/compras-reparaciones-map";
import { LifecycleSankey } from "@/components/analiticas/clientes/lifecycle-sankey";
import { CohortHeatmap } from "@/components/analiticas/clientes/cohort-heatmap";
import { RevenueTimeline } from "@/components/analiticas/clientes/revenue-timeline";
import { ProcedenciaRanking } from "@/components/analiticas/clientes/procedencia-ranking";
import { AtencionClientes } from "@/components/analiticas/clientes/atencion-clientes";
import type {
  Caja,
  Cliente,
  Compra,
  Equipo,
  MovimientoCaja,
  OtroItem,
  Repuesto,
  Ticket,
  Turno,
  Venta,
} from "@/lib/types";
import type { MovimientoStockBulk } from "@/lib/db/inventario";

type Row = { label: string; value: number };

function BarRows({ rows, fmt }: { rows: Row[]; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-neutral-600">{r.label}</span>
            <span className="font-semibold tabular-nums">
              {fmt ? fmt(r.value) : r.value}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-neutral-100">
            <div
              className="h-2 rounded-full bg-accent"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function agrupar(pares: [string, number][]): Row[] {
  return pares
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

const CATEGORIAS = [
  { value: "ventas", label: "Ventas" },
  { value: "reparaciones", label: "Reparaciones" },
  { value: "finanzas", label: "Finanzas" },
  { value: "inventario", label: "Inventario" },
  { value: "clientes", label: "Clientes" },
  { value: "turnos", label: "Turnos" },
] as const;
type Categoria = (typeof CATEGORIAS)[number]["value"];

/** "2026-09" -> "sep 26" — etiqueta de los gráficos por mes. */
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesCorto = (key: string) => {
  const [y, m] = key.split("-");
  return `${MESES_CORTOS[Number(m) - 1]} ${y.slice(2)}`;
};

export function AnaliticasClient({
  ventas,
  equipos,
  repuestos,
  otros,
  clientes,
  turnos,
  cajas,
  movimientosTodos,
  movimientosStock,
  compras,
  tickets,
  salesTrend,
  rubroMesData,
  antiguedadTickets,
  hoy,
}: {
  ventas: Venta[];
  equipos: Equipo[];
  repuestos: Repuesto[];
  otros: OtroItem[];
  clientes: Cliente[];
  turnos: Turno[];
  cajas: Caja[];
  movimientosTodos: MovimientoCaja[];
  movimientosStock: MovimientoStockBulk[];
  compras: Compra[];
  tickets: Ticket[];
  salesTrend: number[];
  rubroMesData: RubroMes[];
  antiguedadTickets: AntiguedadTickets[];
  /** Fecha del server: las ventanas de días del tab Clientes se computan
   *  contra `hoy` para que SSR e hidratación coincidan (husos horarios
   *  distintos romperían la hidratación si cada lado usara su `Date`). */
  hoy: Date;
}) {
  const [tab, setTab] = useState<Categoria>("ventas");
  const dolarVenta = useDolar().venta;

  const [datePreset, setDatePreset] = useState<DatePreset>("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // celda del heatmap de Inventario que afina la lista de "Stock que pide
  // atención" (click en una celda de "Capital por antigüedad")
  const [celdaStock, setCeldaStock] = useState<{
    rango: string;
    categoria: StockCategoria;
  } | null>(null);
  // Filtro de canal del tab Clientes (desde el ranking de procedencia):
  // atenúa los scatters y marca la fila activa. Los KPIs nunca se filtran.
  const [procedenciaFiltro, setProcedenciaFiltro] = useState<string | null>(null);
  const range =
    datePreset === "personalizado"
      ? { desde, hasta }
      : (presetRange(datePreset) ?? { desde: "", hasta: "" });
  const inRange = (iso: string) =>
    (!range.desde || iso >= range.desde) && (!range.hasta || iso <= range.hasta);

  // Solo se filtran por fecha los gráficos que salen de registros con fecha
  // propia (ventas, compras, movimientos de caja, tickets). Los demás son
  // fotos del estado actual (stock, valor de inventario, métricas de
  // clientes del tab Clientes) o series ya fijas por período (tendencias
  // mensuales, turnos de los próximos 7 días) — no hay una fecha real
  // detrás para filtrarlos.
  const ventasFiltradas = ventas.filter((v) => inRange(v.fechaISO));
  const comprasFiltradas = compras.filter((c) => inRange(c.fechaISO));
  const movimientosFiltrados = movimientosTodos.filter((m) => inRange(m.fechaISO));
  const ticketsFiltrados = tickets.filter((t) => inRange(t.fechaISO));

  // ── Reparaciones: distribuciones por período filtrado. La antigüedad de
  // tickets abiertos, en cambio, es una foto del estado actual -- llega ya
  // calculada desde page.tsx (antiguedadTickets), sin filtro de fecha. ──
  const porFalla = ventasBrutasPorFalla(ticketsFiltrados).slice(0, 8);
  const maxPorFalla = Math.max(1, ...porFalla.map((f) => f.totalUsd));
  const maxCantidadPorFalla = Math.max(1, ...porFalla.map((f) => f.tickets));
  const funnel = funnelTickets(ticketsFiltrados);
  const aceptacion = tasaAceptacion(ticketsFiltrados);
  const maxAntiguedad = Math.max(1, ...antiguedadTickets.map((r) => r.tickets));

  // ── Reparaciones: KPIs del período filtrado. `gastoRepuestos` es una
  // aproximación con el costo ACTUAL de cada repuesto -- a diferencia de
  // `VentaItem.costoUsd`, `TicketServicio` no guarda un snapshot del costo
  // al momento de usarlo; un repuesto ya borrado del catálogo no suma nada. ──
  const repuestosPorId = new Map(repuestos.map((r) => [r.id, r]));
  const ingresosReparaciones = ticketsFiltrados.reduce((a, t) => a + t.presupuestoUsd, 0);
  const gastoRepuestosReparaciones = ticketsFiltrados.reduce((a, t) => {
    const usados = t.servicios.filter((s) => s.origen === "repuesto");
    return (
      a +
      usados.reduce((acc, s) => {
        const repuesto = s.repuestoId ? repuestosPorId.get(s.repuestoId) : undefined;
        return acc + (repuesto ? repuesto.costoUsd * (s.cantidad ?? 1) : 0);
      }, 0)
    );
  }, 0);
  const gananciaFinalReparaciones = ingresosReparaciones - gastoRepuestosReparaciones;

  const porMedio = agrupar(
    Object.entries(
      ventasFiltradas
        .flatMap((v) => v.pagos)
        .reduce<Record<string, number>>((a, p) => {
          a[p.medio] = (a[p.medio] ?? 0) + p.montoUsd;
          return a;
        }, {}),
    ),
  ).map((r) => ({
    ...r,
    label: medioPagoCfg[r.label as keyof typeof medioPagoCfg].label,
  }));

  const porCanal = agrupar(
    Object.entries(
      ventasFiltradas.reduce<Record<string, number>>((a, v) => {
        const c = v.procedencia ?? "Sin dato";
        a[c] = (a[c] ?? 0) + v.totalUsd;
        return a;
      }, {}),
    ),
  );

  // ── Ventas: KPIs del período filtrado ──
  const facturacionPeriodo = ventasFiltradas.reduce((a, v) => a + v.totalUsd, 0);
  const cantidadOperaciones = ventasFiltradas.length;
  const ticketPromedio = cantidadOperaciones > 0 ? facturacionPeriodo / cantidadOperaciones : 0;
  const margenPromedio =
    facturacionPeriodo > 0
      ? ventasFiltradas.reduce((a, v) => a + v.margenPct * v.totalUsd, 0) / facturacionPeriodo
      : 0;

  // ── Ventas: mix de rubros del período (treemap) ──
  const rubroTreemap = (() => {
    const totales = new Map<string, number>();
    for (const v of ventasFiltradas) {
      for (const item of v.items) {
        const cat = categoriaDe(item);
        totales.set(cat, (totales.get(cat) ?? 0) + item.precioUsd * item.cantidad);
      }
    }
    // Mismo mapping de colores que TendenciaRubros: chartColor sobre
    // RUBRO_ORDEN, un tono fijo por rubro en toda la sección.
    return RUBRO_ORDEN.map((cat, i) => ({
      label: RUBRO_LABEL[cat],
      value: totales.get(cat) ?? 0,
      color: chartColor(i),
    }));
  })();

  // ── Margen real por rubro del período filtrado: alimenta el gráfico de
  // ganancia de Ventas y la tabla de Finanzas (mismo cálculo que
  // `margenPorTipo`, pero respetando el filtro de fecha) ──
  const margenPeriodo = calcularMargenPorTipo(ventasFiltradas);
  const gananciaPeriodo: Row[] = margenPeriodo
    .map((r) => ({ label: r.tipo, value: r.gananciaUsd }))
    .sort((a, b) => b.value - a.value);
  const maxGanancia = Math.max(1, ...gananciaPeriodo.map((r) => r.value));

  // ── Ventas / Finanzas: ingresos por medio de pago (dona -- misma data
  // en los dos tabs) ──
  const totalMedio = porMedio.reduce((a, r) => a + r.value, 0) || 1;
  const medioSlices = porMedio.map((r, i) => ({
    label: r.label,
    pct: Math.round((r.value / totalMedio) * 100),
    color: chartColor(i),
    valueLabel: fmtUsd(r.value),
  }));

  // ── Ventas: facturación por vendedor (dona con % y monto) ──
  const porVendedor = agrupar(
    Object.entries(
      ventasFiltradas.reduce<Record<string, number>>((a, v) => {
        a[v.vendedor] = (a[v.vendedor] ?? 0) + v.totalUsd;
        return a;
      }, {}),
    ),
  );
  const totalVendedores = porVendedor.reduce((a, r) => a + r.value, 0) || 1;
  const vendedorSlices = porVendedor.map((r, i) => ({
    label: r.label,
    pct: Math.round((r.value / totalVendedores) * 100),
    color: chartColor(i),
    valueLabel: fmtUsd(r.value),
  }));

  // ── Ventas: distribución por día de la semana ──
  const porDiaSemana = ventasPorDiaSemana(ventasFiltradas);
  const maxDiaSemana = Math.max(1, ...porDiaSemana.map((d) => d.usd));

  // ── Inventario: foto del stock + antigüedad reconstruida de los
  // movimientos. KPIs y anillo no filtran por fecha (el stock no tiene
  // fecha propia); el flujo sí -- entradas y salidas tienen fecha de
  // movimiento. Deltas "vs período anterior" no computables: no hay
  // snapshots históricos de stock contra los que comparar. ──
  const stockTodos = stockItems(equipos, repuestos, otros, movimientosStock);
  const agingStock = agingBuckets(stockTodos);
  const valorInventario = stockTodos.reduce((a, i) => a + i.valorUsd, 0);
  const unidadesStock = stockTodos.reduce((a, i) => a + i.unidades, 0);
  const diasInv = diasInventarioEquipos(movimientosStock, ventas);
  const inmovilizado = stockTodos
    .filter((i) => i.dias != null && i.dias > 90)
    .reduce((a, i) => a + i.valorUsd, 0);
  const pctInmovilizado =
    valorInventario > 0 ? (inmovilizado / valorInventario) * 100 : 0;

  // flujo del período filtrado: entradas desde movimientos (equipos son
  // unidades únicas; repuestos/otros traen "+N unidades" en el detalle),
  // salidas desde ventas y reparaciones (los movimientos "egreso" solo
  // cubren repuestos usados en ventas -- la venta de un equipo no genera
  // egreso, cambia su estado)
  const movsStockEnRango = movimientosStock.filter((m) => inRange(m.fechaISO));
  const entradasStock: Record<StockCategoria, number> = { equipo: 0, repuesto: 0, otro: 0 };
  for (const m of movsStockEnRango) {
    if (m.tipo !== "ingreso") continue;
    if (m.itemTipo === "equipo") entradasStock.equipo += 1;
    else entradasStock[m.itemTipo] += unidadesDeMovimiento(m.detalle) ?? 0;
  }
  const salidasStock: Record<StockCategoria, number> = { equipo: 0, repuesto: 0, otro: 0 };
  for (const v of ventasFiltradas) {
    for (const i of v.items) {
      if (i.categoria === "equipo") salidasStock.equipo += i.cantidad;
      if (i.categoria === "otro") salidasStock.otro += i.cantidad;
      for (const r of i.repuestos ?? []) salidasStock.repuesto += r.cantidad;
    }
  }
  for (const t of ticketsFiltrados) {
    for (const s of t.servicios) {
      if (s.origen === "repuesto" && s.repuestoId) salidasStock.repuesto += s.cantidad ?? 1;
    }
  }
  const stockPorCat = Object.fromEntries(
    STOCK_CATS.map((c) => [
      c,
      {
        unidades: stockTodos
          .filter((i) => i.categoria === c)
          .reduce((a, i) => a + i.unidades, 0),
        valor: stockTodos
          .filter((i) => i.categoria === c)
          .reduce((a, i) => a + i.valorUsd, 0),
      },
    ]),
  ) as Record<StockCategoria, { unidades: number; valor: number }>;
  const totalUnidadesStock = STOCK_CATS.reduce((a, c) => a + stockPorCat[c].unidades, 0) || 1;
  const stockUnidadesSlices = STOCK_CATS.map((c, i) => ({
    label: CAT_STOCK_LABEL[c],
    pct: Math.round((stockPorCat[c].unidades / totalUnidadesStock) * 100),
    color: chartColor(i),
    valueLabel: `${stockPorCat[c].unidades} u`,
  }));
  const bajasStock = movsStockEnRango.filter((m) => m.tipo === "baja").length;

  // "pide atención": stock con más de 90 días, ordenado por el valor
  // atado a costo (lo que duele). La celda del heatmap afina rango/categoría.
  const rangoDeStock = (dias: number) => AGING_RANGOS.findIndex((r) => dias <= r.max);
  const atencion = stockTodos
    .filter((i) => i.dias != null && i.dias > 90)
    .filter(
      (i) =>
        !celdaStock ||
        (i.categoria === celdaStock.categoria &&
          rangoDeStock(i.dias as number) ===
            AGING_RANGOS.findIndex((r) => r.rango === celdaStock.rango)),
    )
    .sort((a, b) => b.valorUsd - a.valorUsd)
    .slice(0, 8);

  // facturación acumulada (14 días)
  const W = 640;
  const H = 160;
  let acc = 0;
  const acum = salesTrend.map((d) => (acc += d));
  const maxAcum = acum[acum.length - 1] || 1;
  const pts = acum.map((v, i) => {
    const x = (i / Math.max(1, acum.length - 1)) * W;
    const y = H - (v / maxAcum) * (H - 12);
    return `${x},${y}`;
  });
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${W},${H} L0,${H} Z`;

  // ── Finanzas: ingresos vs egresos de Cajas, todo convertido a USD ──
  const cajaById = new Map(cajas.map((c) => [c.id, c]));
  const enUsd = (m: MovimientoCaja) => {
    const caja = cajaById.get(m.cajaId);
    if (!caja) return 0;
    return caja.moneda === "usd" ? m.monto : m.monto / dolarVenta;
  };
  const ingresosUsd = movimientosFiltrados
    .filter((m) => m.tipo === "ingreso")
    .reduce((a, m) => a + enUsd(m), 0);
  const egresosUsd = movimientosFiltrados
    .filter((m) => m.tipo === "egreso")
    .reduce((a, m) => a + enUsd(m), 0);
  const netoUsd = ingresosUsd - egresosUsd;

  // ── Finanzas: ganancia real del período (ventas: precio − costo) ──
  const gananciaPeriodoUsd = margenPeriodo.reduce((a, r) => a + r.gananciaUsd, 0);

  // ── Finanzas: evolución mensual de facturación vs ganancia (margen) ──
  const rentabilidadMes = rentabilidadPorMes(ventasFiltradas);

  // ── Finanzas: flujo de caja por mes (movimientos de cajas, en USD),
  //    con caja acumulada al cierre de cada mes ──
  const flujoMes = (() => {
    const meses = new Map<string, { ingresos: number; egresos: number }>();
    for (const m of movimientosFiltrados) {
      const key = m.fechaISO.slice(0, 7);
      const fila = meses.get(key) ?? { ingresos: 0, egresos: 0 };
      if (m.tipo === "ingreso") fila.ingresos += enUsd(m);
      else fila.egresos += enUsd(m);
      meses.set(key, fila);
    }
    let acumulado = 0;
    return [...meses.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const neto = v.ingresos - v.egresos;
        acumulado += neto;
        return { key, label: mesCorto(key), ...v, neto, acumulado };
      });
  })();

  // ── Finanzas: gastos de cajas agrupados por categoría estructurada
  //    (`MovimientoCaja.categoria`). Egresos de antes de este campo (o
  //    cargados sin categoría) caen en "Sin categoría" -- no se inventa. ──
  const gastosPorCategoria = (() => {
    const totales = new Map<string, number>();
    for (const m of movimientosFiltrados) {
      if (m.tipo !== "egreso") continue;
      const categoria = m.categoria ? categoriaGastoCfg[m.categoria].label : "Sin categoría";
      totales.set(categoria, (totales.get(categoria) ?? 0) + enUsd(m));
    }
    const total = [...totales.values()].reduce((a, b) => a + b, 0);
    const filas = [...totales.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([categoria, monto]) => ({
        categoria,
        monto,
        pct: total > 0 ? (monto / total) * 100 : 0,
      }));
    return { total, filas };
  })();
  const maxGasto = Math.max(1, ...gastosPorCategoria.filas.map((g) => g.monto));

  // ── Finanzas: compras (inversión en stock) vs facturación por mes ──
  const comprasVentasMes = (() => {
    const meses = new Map<string, { ventas: number; compras: number }>();
    const acum = (iso: string, campo: "ventas" | "compras", monto: number) => {
      const key = iso.slice(0, 7);
      const fila = meses.get(key) ?? { ventas: 0, compras: 0 };
      fila[campo] += monto;
      meses.set(key, fila);
    };
    for (const v of ventasFiltradas) acum(v.fechaISO, "ventas", v.totalUsd);
    for (const c of comprasFiltradas) acum(c.fechaISO, "compras", c.totalUsd);
    return [...meses.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, label: mesCorto(key), ...v }));
  })();
  const maxComprasVentas = Math.max(
    1,
    ...comprasVentasMes.flatMap((m) => [m.ventas, m.compras]),
  );
  // Cobertura del período: USD facturados por cada USD comprado. No es
  // una "rotación de stock": eso necesitaría inventario promedio histórico,
  // que el modelo no guarda -- ratio simple, datos reales, nombre honesto.
  const totalVentasMes = comprasVentasMes.reduce((a, m) => a + m.ventas, 0);
  const totalComprasMes = comprasVentasMes.reduce((a, m) => a + m.compras, 0);
  const cobertura =
    totalComprasMes > 0 ? totalVentasMes / totalComprasMes : null;

  // ── Clientes: Customer Intelligence (lib/clientes-inteligencia.ts es la
  // fuente de verdad de las definiciones). Foto del estado actual, sin
  // filtro de fecha: son métricas de estado/ventana, no de flujo del
  // período -- el recorrido completo entra crudo y cada métrica corta su
  // propia ventana. Se memoiza pesado (cruza clientes×ventas×tickets). ──
  const intel = useMemo(
    () => clientesIntel(clientes, ventas, tickets, hoy),
    [clientes, ventas, tickets, hoy],
  );
  const kpis = useMemo(() => kpisClientes(intel, hoy), [intel, hoy]);
  const cohortes = useMemo(() => cohortesClientes(intel, hoy), [intel, hoy]);
  const flujo = useMemo(() => flujoClientes(intel), [intel]);
  const ranking = useMemo(() => procedenciaRanking(intel), [intel]);
  const ingresosClientes = useMemo(
    () => ingresosPorMesClientes(ventas, tickets, intel, hoy),
    [ventas, tickets, intel, hoy],
  );
  // Color por canal: el orden del ranking (clientes desc) fija el tono de
  // cada canal en TODOS los gráficos del tab. "Sin dato" no entra a la
  // paleta: gris neutro, no un tono de la serie (no es un canal real).
  const colorDe = useMemo(() => {
    const mapa = new Map<string, string>();
    let i = 0;
    for (const fila of ranking) {
      if (fila.label === SIN_PROCEDENCIA) continue;
      mapa.set(fila.label, chartColor(i++));
    }
    return (procedencia: string | null) =>
      procedencia == null ? "#d4d4d8" : (mapa.get(procedencia) ?? "#d4d4d8");
  }, [ranking]);

  // ── Turnos ──
  const turnosPorTipo: Row[] = (
    Object.keys(turnoTipo) as (keyof typeof turnoTipo)[]
  ).map((t) => ({
    label: turnoTipo[t].label,
    value: turnos.filter((x) => x.tipo === t).length,
  }));

  const turnosPorEstado: Row[] = (
    Object.keys(turnoStatus) as (keyof typeof turnoStatus)[]
  ).map((e) => ({
    label: turnoStatus[e].label,
    value: turnos.filter((x) => x.estado === e).length,
  }));

  const turnosPorHora: Row[] = Array.from({ length: 12 }, (_, i) => {
    const h = `${String(i + 9).padStart(2, "0")}:00`;
    return { label: h, value: turnos.filter((t) => t.hora === h).length };
  });
  const maxPorHora = Math.max(1, ...turnosPorHora.map((x) => x.value));

  // ── Turnos: KPIs -- sobre los turnos de los próximos 7 días (mismo
  // alcance que el resto de la pestaña, ver "Turnos" en CLAUDE.md). ──
  const turnosConfirmados = turnos.filter((t) => t.estado === "confirmado").length;
  const turnosCancelados = turnos.filter((t) => t.estado === "cancelado").length;
  const tasaConfirmacionTurnos = turnos.length > 0 ? (turnosConfirmados / turnos.length) * 100 : 0;

  return (
    <Section title="Analíticas">
      <div className="space-y-6">
        {/* El filtro de fecha vive acá, no en el toolbar de la Topbar -- ese
            es un h-14 fijo y en mobile este control (select + 2 fechas +
            "limpiar") no entra en una sola línea sin cortarse. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className={cn("w-full sm:w-44", filterPill)}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          {datePreset === "personalizado" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className={cn("w-full sm:w-36", filterPill)}
              />
              <span className="text-xs text-neutral-400">a</span>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className={cn("w-full sm:w-36", filterPill)}
              />
            </div>
          )}
          {datePreset !== "todos" && (
            <button
              onClick={() => {
                setDatePreset("todos");
                setDesde("");
                setHasta("");
              }}
              className="text-xs text-neutral-400 hover:text-neutral-600"
            >
              limpiar fecha
            </button>
          )}
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          options={CATEGORIAS.map((c) => ({ value: c.value, label: c.label }))}
        />

        {tab === "ventas" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Facturación" value={fmtUsd(facturacionPeriodo)} />
              <StatCard label="Ticket promedio" value={fmtUsd(Math.round(ticketPromedio))} />
              <StatCard label="Operaciones" value={cantidadOperaciones} />
              <StatCard label="Margen promedio" value={`${margenPromedio.toFixed(1)}%`} />
            </div>

            {/* Lo que sirve desde el primer día de uso, arriba. */}
            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider>Facturación por vendedor</ChartTitle>
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <DonutChart slices={vendedorSlices} />
                </div>
              </Card>
              <Card className="p-5">
                <ChartTitle align="left" divider>Ventas por canal</ChartTitle>
                <BarRows rows={porCanal} fmt={fmtUsd} />
              </Card>
            </div>

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider>Ingresos por medio de pago</ChartTitle>
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <DonutChart slices={medioSlices} />
                </div>
              </Card>
              <Card className="p-5">
                <ChartTitle align="left" divider sub="del período filtrado">Mix de rubros</ChartTitle>
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <Treemap data={rubroTreemap} fmt={fmtUsd} />
                </div>
              </Card>
            </div>

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider>Ganancia por categoría</ChartTitle>
                <div className="mt-5 flex items-end gap-3">
                  {gananciaPeriodo.map((r) => (
                    <div key={r.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <span className="text-[11px] font-medium text-neutral-400">
                        {r.value > 0 ? fmtUsd(r.value) : ""}
                      </span>
                      <div
                        className="w-full rounded-t-xl bg-accent"
                        style={{ height: `${Math.max(4, (r.value / maxGanancia) * 140)}px` }}
                      />
                      <span className="w-full truncate text-center text-xs text-neutral-500">
                        {r.label}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5">
                <ChartTitle align="left" divider>Ventas por día de la semana</ChartTitle>
                <div className="mt-5 flex items-end gap-3">
                  {porDiaSemana.map((d) => (
                    <div key={d.dia} className="flex flex-1 flex-col items-center gap-2">
                      <span className="text-[11px] font-medium text-neutral-400">
                        {d.usd > 0 ? fmtUsd(d.usd) : ""}
                      </span>
                      <div
                        className="w-full rounded-t-xl bg-accent"
                        style={{ height: `${Math.max(4, (d.usd / maxDiaSemana) * 140)}px` }}
                      />
                      <span className="text-xs text-neutral-500">{d.dia}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <ChartTitle align="left" divider sub="últimos 14 días">Facturación acumulada</ChartTitle>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-2xl font-semibold tabular-nums">{fmtUsd(maxAcum)}</span>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-40 w-full">
                <defs>
                  <linearGradient id="acumFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_ACCENT} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill="url(#acumFill)" />
                <path
                  d={line}
                  fill="none"
                  stroke={CHART_ACCENT}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </Card>

            {/* El único gráfico por mes que queda: la "Tendencia por rubro"
                ya muestra el total de cada mes (columna + monto abajo +
                variación MoM), así que un "Ventas por mes" aparte sería el
                mismo dato sin el desglose. Va al final porque con menos de
                3-6 meses de historial se ve vacío (una o dos columnas). */}
            <TendenciaRubros data={rubroMesData} className="min-h-[340px]" />
          </div>
        )}

        {tab === "reparaciones" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Reparaciones" value={ticketsFiltrados.length} />
              <StatCard label="Ingresos" value={fmtUsd(ingresosReparaciones)} />
              <StatCard label="Gasto en repuestos" value={fmtUsd(gastoRepuestosReparaciones)} />
              <StatCard label="Ganancia final" value={fmtUsd(gananciaFinalReparaciones)} />
            </div>

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider sub="tickets sin entregar, ahora mismo">
                  Antigüedad de tickets abiertos
                </ChartTitle>
                <ul className="mt-4 space-y-3">
                  {antiguedadTickets.map((r) => (
                    <li key={r.rango}>
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-neutral-600">{r.rango}</span>
                        <span className="font-semibold tabular-nums">{r.tickets} tickets</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-neutral-100">
                        <div
                          className="h-2 rounded-full bg-accent"
                          style={{ width: `${(r.tickets / maxAntiguedad) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>

              <GaugeAceptacion
                presupuestadas={aceptacion.presupuestadas}
                aceptadas={aceptacion.aceptadas}
                pct={aceptacion.pct}
              />
            </div>

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider sub="período filtrado">
                  Reparaciones por tipo de falla
                </ChartTitle>
                {porFalla.length === 0 ? (
                  <p className="mt-4 text-center text-[13px] text-neutral-400">
                    Sin tickets en el período.
                  </p>
                ) : (
                  <>
                    <div className="mt-3 flex items-center gap-4 text-[11px] text-neutral-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-accent" /> Facturado
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-neutral-400" /> Reparaciones
                      </span>
                    </div>
                    {/* Compacto a propósito: comparte fila con Antigüedad, así
                     * que la cantidad va inline en el label y las dos barras
                     * quedan pegadas -- una fila por métrica estiraba la card
                     * y descuadraba la de al lado. */}
                    <ul className="mt-3 space-y-2.5">
                      {porFalla.map((f) => (
                        <li key={f.falla}>
                          <div className="flex items-center justify-between gap-3 text-[13px]">
                            <span className="truncate text-neutral-600">
                              {f.falla}
                              <span className="ml-1.5 text-[11px] text-neutral-400">
                                {f.tickets} rep
                              </span>
                            </span>
                            <span className="font-semibold tabular-nums">{fmtUsd(f.totalUsd)}</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-neutral-100">
                            <div
                              className="h-2 rounded-full bg-accent"
                              style={{ width: `${(f.totalUsd / maxPorFalla) * 100}%` }}
                            />
                          </div>
                          <div className="mt-0.5 h-1.5 rounded-full bg-neutral-100">
                            <div
                              className="h-1.5 rounded-full bg-neutral-400"
                              style={{ width: `${(f.tickets / maxCantidadPorFalla) * 100}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
              <HeatmapActividad tickets={ticketsFiltrados} />
            </div>

            {/* Sin "tiempo promedio de reparación" a propósito: `tickets`
                no guarda timestamp de cierre (ver `antiguedadTicketsAbiertos`
                en lib/analiticas.ts) -- sin esa fecha la métrica no es
                calculable y no se inventa. */}
            <FunnelReparaciones etapas={funnel} />
          </div>
        )}

        {tab === "finanzas" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Ingresos (cajas)" value={fmtUsd(ingresosUsd)} />
              <StatCard label="Egresos (cajas)" value={fmtUsd(egresosUsd)} />
              <StatCard label="Neto (cajas)" value={fmtUsd(netoUsd)} />
              <StatCard label="Ganancia (ventas)" value={fmtUsd(gananciaPeriodoUsd)} />
            </div>

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <RentabilidadEvolucion data={rentabilidadMes} />
              <WaterfallResultado rows={margenPeriodo} />
            </div>

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <ScatterMargen rows={margenPeriodo} />
              <Card className="p-5">
                <ChartTitle align="left" divider sub="facturación del período, por tipo de operación">
                  Origen de ingresos
                </ChartTitle>
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <Treemap data={rubroTreemap} fmt={fmtUsd} />
                </div>
              </Card>
            </div>

            {/* Por mes, mismo criterio que Ventas: al final, porque con
                menos de 3-6 meses de historial se ven vacíos. */}
            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <FlujoCaja meses={flujoMes} />

              <Card className="flex h-full flex-col p-5">
                <ChartTitle
                  align="left"
                  divider
                  sub={
                    cobertura != null
                      ? `cobertura del período: ${cobertura.toFixed(1)}× de venta por USD comprado`
                      : "inversión en stock vs facturación"
                  }
                >
                  Compras vs ventas por mes
                </ChartTitle>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    Ventas
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    Compras
                  </span>
                </div>
                {comprasVentasMes.length === 0 ? (
                  <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
                    Sin ventas ni compras en el período filtrado.
                  </p>
                ) : (
                  // `mt-auto` -- mismo criterio que `HeatmapActividad`: esta
                  // card no tiene el bloque de "caja acumulada" que sí tiene
                  // `FlujoCaja` (al lado, mismo grid row), así que sin esto
                  // las barras arrancaban más arriba que las de esa card y
                  // los dos gráficos no se leían en la misma línea de base.
                  <div className="mt-auto flex items-end gap-3 pt-5 sm:gap-4">
                    {comprasVentasMes.map((m) => {
                      // Ratio del mes: ventas por cada USD comprado. Sin
                      // compras no hay ratio (evita Infinity) -- el "—" lo
                      // dice con el tooltip.
                      const ratio = m.compras > 0 ? m.ventas / m.compras : null;
                      return (
                        <div key={m.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                          <div
                            className="flex w-full items-end justify-center gap-1.5"
                            title={`${m.label}: ventas ${fmtUsd(m.ventas)} · compras ${fmtUsd(m.compras)}${ratio != null ? ` · cobertura ${(ratio).toFixed(1)}×` : " · sin compras este mes"}`}
                          >
                            <div
                              className="w-[38%] rounded-t-md bg-accent"
                              style={{ height: `${Math.max(4, (m.ventas / maxComprasVentas) * 140)}px` }}
                            />
                            <div
                              className="w-[38%] rounded-t-md bg-red-400"
                              style={{ height: `${Math.max(4, (m.compras / maxComprasVentas) * 140)}px` }}
                            />
                          </div>
                          <span className="text-xs text-neutral-500">{m.label}</span>
                          <span
                            className={cn(
                              "text-[10px] font-medium tabular-nums",
                              ratio == null
                                ? "text-neutral-300"
                                : ratio >= 1
                                  ? "text-emerald-600"
                                  : "text-red-500",
                            )}
                          >
                            {ratio != null ? `${ratio.toFixed(1)}×` : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Gastos + medios de pago: secundarios, cierran el tab. */}
            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle
                  align="left"
                  divider
                  sub="egresos de cajas, en USD — agrupados por categoría"
                >
                  Gastos por categoría
                </ChartTitle>
                {gastosPorCategoria.filas.length === 0 ? (
                  <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
                    Sin egresos en el período filtrado.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {gastosPorCategoria.filas.slice(0, 6).map((g) => (
                      <li
                        key={g.categoria}
                        title={`${g.categoria}: ${fmtUsd(g.monto)} (${g.pct.toFixed(1)}% del gasto total)`}
                      >
                        <div className="flex items-center gap-3 text-[13px]">
                          <span className="w-28 shrink-0 truncate text-neutral-600 sm:w-36">
                            {g.categoria}
                          </span>
                          <div className="h-2 min-w-0 flex-1 rounded-full bg-neutral-100">
                            <div
                              className="h-2 rounded-full bg-red-400"
                              style={{ width: `${(g.monto / maxGasto) * 100}%` }}
                            />
                          </div>
                          <span className="w-16 shrink-0 text-right font-semibold tabular-nums">
                            {fmtUsd(g.monto)}
                          </span>
                          <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-neutral-400">
                            {Math.round(g.pct)}%
                          </span>
                        </div>
                      </li>
                    ))}
                    {gastosPorCategoria.filas.length > 6 && (
                      <li
                        title={`Resto de categorías: ${fmtUsd(
                          gastosPorCategoria.filas.slice(6).reduce((a, g) => a + g.monto, 0),
                        )}`}
                      >
                        <div className="flex items-center gap-3 text-[13px]">
                          <span className="w-28 shrink-0 truncate text-neutral-500 sm:w-36">
                            Otros ({gastosPorCategoria.filas.length - 6})
                          </span>
                          <div className="h-2 min-w-0 flex-1 rounded-full bg-neutral-100">
                            <div
                              className="h-2 rounded-full bg-red-400/60"
                              style={{
                                width: `${(gastosPorCategoria.filas.slice(6).reduce((a, g) => a + g.monto, 0) / maxGasto) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="w-16 shrink-0 text-right font-medium tabular-nums text-neutral-500">
                            {fmtUsd(gastosPorCategoria.filas.slice(6).reduce((a, g) => a + g.monto, 0))}
                          </span>
                          <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-neutral-400">
                            {Math.round(
                              gastosPorCategoria.filas.slice(6).reduce((a, g) => a + g.pct, 0),
                            )}%
                          </span>
                        </div>
                      </li>
                    )}
                  </ul>
                )}
              </Card>

              <Card className="p-5">
                <ChartTitle align="left" divider>Ingresos por medio de pago</ChartTitle>
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <DonutChart slices={medioSlices} />
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "inventario" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Valor a costo"
                value={fmtUsd(valorInventario)}
                hint="foto del stock actual"
              />
              <StatCard
                label="Unidades"
                value={unidadesStock}
                hint="equipos + repuestos + accesorios"
              />
              <StatCard
                label="Días de inventario"
                value={diasInv ?? "—"}
                hint="promedio ingreso → venta, equipos"
              />
              <StatCard
                label="Capital inmovilizado"
                value={fmtUsd(inmovilizado)}
                hint={`${pctInmovilizado.toFixed(0)}% del valor · más de 90 días`}
                valueClassName={inmovilizado > 0 ? "text-amber-600" : undefined}
              />
            </div>

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <AgingRing buckets={agingStock} />
              <InventarioValor equipos={equipos} repuestos={repuestos} otros={otros} />
            </div>

            <Card className="p-5">
              <ChartTitle align="left" divider sub="foto del stock actual">
                Unidades por categoría
              </ChartTitle>
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <DonutChart slices={stockUnidadesSlices} legend="row" />
              </div>
            </Card>

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <StockQuadrant
                itemsTodos={stockTodos}
                items={stockTodos}
                salidas={salidasStock}
              />
              <StockHeatmap
                buckets={agingStock}
                seleccion={celdaStock}
                onSeleccion={setCeldaStock}
              />
            </div>

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <InventarioFlow
                entradas={entradasStock}
                salidas={salidasStock}
                stock={stockPorCat}
                bajas={bajasStock}
              />

              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <ChartTitle
                    align="left"
                    divider
                    sub="más de 90 días en stock, por valor atado a costo"
                  >
                    Stock que pide atención
                  </ChartTitle>
                  <Link
                    href="/inventario"
                    className="shrink-0 rounded-full border border-accent/40 px-4 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-accent/70"
                  >
                    Ver inventario
                  </Link>
                </div>
                {celdaStock && (
                  <p className="mt-2 text-[11px] text-neutral-400">
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
                  <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-400">
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
                          <p className="text-[11px] text-neutral-400">
                            {CAT_STOCK_LABEL[i.categoria]} · {i.unidades} u
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-4 text-right">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                              Días
                            </p>
                            <p className="tabular-nums font-medium text-red-500">{i.dias}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
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
        )}

        {tab === "clientes" && (
          <div className="space-y-6">
            {/* KPIs: foto del estado actual -- nunca se filtran por canal.
                Las definiciones exactas (ventanas, denominadores) viven en
                lib/clientes-inteligencia.ts. */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Clientes activos"
                value={kpis.activos}
                delta={kpis.deltaActivos ?? undefined}
                deltaHint={`vs ventana previa (${DIAS_ACTIVO} días)`}
                hint={`con operaciones en los últimos ${DIAS_ACTIVO} días`}
              />
              <StatCard
                label="Valor por cliente activo"
                value={fmtUsd(Math.round(kpis.valorPromedio))}
                delta={kpis.deltaValorPromedio ?? undefined}
                deltaHint={`vs ventana previa (${DIAS_ACTIVO} días)`}
                hint={`gasto en los últimos ${DIAS_ACTIVO} días ÷ activos`}
              />
              <StatCard
                label="Tasa de recurrencia"
                value={`${kpis.tasaRecurrencia.toFixed(0)}%`}
                hint="con 2+ operaciones sobre los que tienen alguna"
              />
              <StatCard
                label="En riesgo"
                value={kpis.enRiesgo}
                valueClassName={kpis.enRiesgo > 0 ? "text-red-500" : undefined}
                hint={
                  kpis.enRiesgo > 0
                    ? `sin actividad hace ${DIAS_RIESGO}+ días · valen ${fmtUsd(kpis.riesgoValorUsd)}`
                    : "nadie superó la ventana de riesgo"
                }
              />
            </div>

            <ValueMap intel={intel} filtro={procedenciaFiltro} colorDe={colorDe} />

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <ComprasReparacionesMap
                intel={intel}
                filtro={procedenciaFiltro}
                colorDe={colorDe}
              />
              <LifecycleSankey flujo={flujo} />
            </div>

            <CohortHeatmap cohortes={cohortes} intel={intel} />

            <RevenueTimeline ingresos={ingresosClientes} />

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <ProcedenciaRanking
                ranking={ranking}
                filtro={procedenciaFiltro}
                onFiltro={setProcedenciaFiltro}
                colorDe={colorDe}
              />
              <AtencionClientes intel={intel} />
            </div>
          </div>
        )}

        {tab === "turnos" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Turnos (7 días)" value={turnos.length} />
              <StatCard label="Confirmados" value={turnosConfirmados} />
              <StatCard
                label="Cancelados"
                value={turnosCancelados}
                valueClassName={turnosCancelados > 0 ? "text-red-500" : undefined}
              />
              <StatCard label="Tasa de confirmación" value={`${tasaConfirmacionTurnos.toFixed(0)}%`} />
            </div>

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider>Turnos por tipo</ChartTitle>
                <BarRows rows={turnosPorTipo} />
              </Card>
              <Card className="p-5">
                <ChartTitle align="left" divider>Asistencia vs cancelación</ChartTitle>
                <BarRows rows={turnosPorEstado} />
              </Card>
            </div>
            <Card className="p-5">
              <ChartTitle align="left" divider sub="09 a 20 h, próximos 7 días">
                Ocupación por franja horaria
              </ChartTitle>
              <div className="mt-5 flex items-end gap-2">
                {turnosPorHora.map((h) => (
                  <div key={h.label} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-[11px] font-medium text-neutral-400">{h.value || ""}</span>
                    <div
                      className="w-full rounded-t-xl bg-accent"
                      style={{ height: `${Math.max(4, (h.value / maxPorHora) * 100)}px` }}
                    />
                    <span className="text-[10px] text-neutral-500">{h.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </Section>
  );
}
