/** Resúmenes por pestaña de Analíticas: funciones puras (sin Supabase) que
 * reciben los datos crudos que `page.tsx` ya trae y devuelven el objeto
 * serializable que dibuja cada pestaña. Todo el cálculo que antes vivía
 * inline en `analiticas-client.tsx` se movió acá para que el server lo haga
 * una sola vez y el cliente quede como presentación (plan 008). */

import type {
  Caja,
  Cliente,
  Compra,
  Equipo,
  MovimientoCaja,
  MovimientoCC,
  OtroItem,
  Repuesto,
  Ticket,
  Turno,
  Venta,
} from "@/lib/types";
import type { MovimientoStockBulk } from "@/lib/db/inventario";
import {
  AGING_RANGOS,
  CAT_STOCK_LABEL,
  STOCK_CATS,
  actividadTickets,
  agingBuckets,
  cobradoReparaciones,
  diasInventarioEquipos,
  funnelTickets,
  margenPorTipo,
  movimientoEnUsd,
  rentabilidadPorMes,
  sinCotizacion,
  stockItems,
  tasaAceptacion,
  unidadesDeMovimiento,
  ventasBrutasPorFalla,
  ventasPorDiaSemana,
  ventasPorRubroMes,
  type AntiguedadTickets,
  type CobradoReparaciones,
  type FunnelEtapa,
  type MargenPorTipo,
  type RentabilidadMes,
  type RubroMes,
  type SinCotizacion,
  type StockCategoria,
  type StockItem,
  type TasaAceptacion,
  type VentaDia,
} from "@/lib/analiticas";
import { enRango, hoyISO, sumarDias, type Rango } from "@/lib/date-presets";
import { RUBRO_LABEL, RUBRO_ORDEN, categoriaDe, margenPonderado, type Rubro } from "@/lib/ventas";
import { chartColor } from "@/lib/chart";
import { medioPago as medioPagoCfg, categoriaGasto as categoriaGastoCfg } from "@/lib/status";
import {
  SIN_PROCEDENCIA,
  clientesIntel,
  cohortesClientes,
  flujoClientes,
  ingresosPorMesClientes,
  kpisClientes,
  procedenciaRanking,
  type ClienteIntel,
  type CohorteFila,
  type FlujoClientes,
  type IngresoMes,
  type KpisClientes,
  type ProcedenciaRow,
} from "@/lib/clientes-inteligencia";

export type ContextoAnaliticas = {
  rango: Rango;
  rangoAnterior: Rango | null;
  preset: string;
  hoy: Date;
};

export type Row = { label: string; value: number };

function agrupar(pares: [string, number][]): Row[] {
  return pares
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** Deltas % de un período contra el anterior. `undefined` cuando no hay
 * contra qué comparar (sin rango anterior, o base 0). */
export type Deltas = {
  facturacion?: number;
  operaciones?: number;
  ticketPromedio?: number;
  margen?: number;
};

function deltaDe(actual: number, anterior: number | undefined): number | undefined {
  if (anterior === undefined || anterior === 0) return undefined;
  return ((actual - anterior) / anterior) * 100;
}

// ───────────────────────────── Ventas ─────────────────────────────

export type ResumenVentasAnaliticas = {
  facturacion: number;
  operaciones: number;
  ticketPromedio: number;
  margenPct: number | null;
  deltas: Deltas;
  porCanal: Row[];
  porVendedor: { label: string; value: number; operaciones: number; pct: number }[];
  rubroTreemap: { label: string; value: number; color: string }[];
  margenPorTipo: MargenPorTipo[];
  porDiaSemana: VentaDia[];
  facturacionAcumulada: { valores: number[]; total: number; etiquetas: string[] };
  rubroMes: RubroMes[];
  rubroMesChip: string | null;
};

function acumuladoDelRango(ventas: Venta[], rango: Rango, hoy: Date): {
  valores: number[];
  total: number;
  etiquetas: string[];
} {
  const hoyIso = hoyISO(hoy);
  const desde = rango.desde || (ventas.length ? [...ventas].sort((a, b) => a.fechaISO.localeCompare(b.fechaISO))[0].fechaISO.slice(0, 10) : "");
  const hastaReal = rango.hasta && rango.hasta < hoyIso ? rango.hasta : hoyIso;
  if (!desde || desde > hastaReal) return { valores: [], total: 0, etiquetas: [] };

  const porDia = new Map<string, number>();
  for (const v of ventas) {
    const dia = v.fechaISO.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + v.totalUsd);
  }
  // Con "Todas las fechas" (sin rango) se agrupa por mes para no dibujar
  // cientos de puntos.
  if (!rango.desde) {
    const porMes = new Map<string, number>();
    for (const v of ventas) {
      const key = v.fechaISO.slice(0, 7);
      porMes.set(key, (porMes.get(key) ?? 0) + v.totalUsd);
    }
    const claves = [...porMes.keys()].sort();
    let acc = 0;
    const valores = claves.map((k) => (acc += porMes.get(k) ?? 0));
    return { valores, total: Math.round(acc), etiquetas: claves };
  }

  const valores: number[] = [];
  const etiquetas: string[] = [];
  let acc = 0;
  const n = Math.max(1, Math.round((Date.parse(hastaReal) - Date.parse(desde)) / 86_400_000) + 1);
  for (let i = 0; i < n; i++) {
    const dia = sumarDias(desde, i);
    acc += porDia.get(dia) ?? 0;
    valores.push(Math.round(acc));
    etiquetas.push(dia);
  }
  return { valores, total: Math.round(acc), etiquetas };
}

export function resumenVentas(
  ventas: Venta[],
  ctx: ContextoAnaliticas,
): ResumenVentasAnaliticas {
  const filtradas = ventas.filter((v) => enRango(v.fechaISO, ctx.rango));
  const facturacion = filtradas.reduce((a, v) => a + v.totalUsd, 0);
  const operaciones = filtradas.length;
  const ticketPromedio = operaciones > 0 ? facturacion / operaciones : 0;
  const margenPct = margenPonderado(filtradas);

  const anterior = ctx.rangoAnterior
    ? ventas.filter((v) => enRango(v.fechaISO, ctx.rangoAnterior as Rango))
    : [];
  const factAnt = anterior.reduce((a, v) => a + v.totalUsd, 0);
  const opAnt = anterior.length;
  const margenAnt = ctx.rangoAnterior ? margenPonderado(anterior) : null;
  const deltas: Deltas = {
    facturacion: deltaDe(facturacion, factAnt),
    operaciones: deltaDe(operaciones, opAnt),
    ticketPromedio: deltaDe(ticketPromedio, opAnt > 0 ? factAnt / opAnt : 0),
    margen:
      margenPct !== null && margenAnt !== null ? margenPct - margenAnt : undefined,
  };

  const porCanal = agrupar(
    Object.entries(
      filtradas.reduce<Record<string, number>>((a, v) => {
        const c = v.procedencia ?? "Sin dato";
        a[c] = (a[c] ?? 0) + v.totalUsd;
        return a;
      }, {}),
    ),
  );

  const porVendedorMap = new Map<string, { value: number; operaciones: number }>();
  for (const v of filtradas) {
    const f = porVendedorMap.get(v.vendedor) ?? { value: 0, operaciones: 0 };
    f.value += v.totalUsd;
    f.operaciones += 1;
    porVendedorMap.set(v.vendedor, f);
  }
  const totalVendedor = [...porVendedorMap.values()].reduce((a, f) => a + f.value, 0) || 1;
  const porVendedor = [...porVendedorMap.entries()]
    .map(([label, f]) => ({
      label,
      value: Math.round(f.value),
      operaciones: f.operaciones,
      pct: (f.value / totalVendedor) * 100,
    }))
    .sort((a, b) => b.value - a.value);

  const rubroTotales = new Map<Rubro, number>();
  for (const v of filtradas) {
    for (const item of v.items) {
      const cat = categoriaDe(item);
      rubroTotales.set(cat, (rubroTotales.get(cat) ?? 0) + item.precioUsd * item.cantidad);
    }
  }
  const rubroTreemap = RUBRO_ORDEN.map((cat, i) => ({
    label: RUBRO_LABEL[cat],
    value: Math.round(rubroTotales.get(cat) ?? 0),
    color: chartColor(i),
  }));

  const margenTipo = margenPorTipo(filtradas);
  const porDiaSemana = ventasPorDiaSemana(filtradas, ctx.rango, ctx.hoy);
  const acumulada = acumuladoDelRango(filtradas, ctx.rango, ctx.hoy);

  // Tendencia por rubro: meses dentro del rango; si el rango es menor a 3
  // meses, los 3 que terminan en `hasta` (con chip que lo aclara).
  const hoyIso = hoyISO(ctx.hoy);
  const hasta = ctx.rango.hasta && ctx.rango.hasta < hoyIso ? ctx.rango.hasta : hoyIso;
  const desde = ctx.rango.desde;
  let meses = 6;
  let chip: string | null = null;
  if (desde && hasta) {
    const [yd, md] = desde.split("-").map(Number);
    const [yh, mh] = hasta.split("-").map(Number);
    const n = (yh - yd) * 12 + (mh - md) + 1;
    if (n < 3) {
      meses = 3;
      chip = "Últimos 3 meses";
    } else {
      meses = Math.min(12, n);
    }
  }
  const rubroMesData = ventasPorRubroMes(filtradas, meses, ctx.hoy);

  return {
    facturacion,
    operaciones,
    ticketPromedio,
    margenPct,
    deltas,
    porCanal,
    porVendedor,
    rubroTreemap,
    margenPorTipo: margenTipo,
    porDiaSemana,
    facturacionAcumulada: acumulada,
    rubroMes: rubroMesData,
    rubroMesChip: chip,
  };
}

// ─────────────────────────── Reparaciones ───────────────────────────

export type ResumenReparaciones = {
  cantidad: number;
  cobrado: CobradoReparaciones;
  /** Delta % de lo cobrado vs período anterior (undefined sin comparación). */
  cobradoDelta?: number;
  gastoRepuestos: number;
  gananciaFinal: number;
  sinCotizacionReparaciones: { cantidad: number; ars: number };
  antiguedad: AntiguedadTickets[];
  aceptacion: TasaAceptacion;
  funnel: FunnelEtapa[];
  porFalla: { falla: string; totalUsd: number; tickets: number }[];
  actividadGrid: number[][];
};

export function resumenReparaciones(
  tickets: Ticket[],
  movsCaja: MovimientoCaja[],
  movsCC: MovimientoCC[],
  cajas: Caja[],
  repuestos: Repuesto[],
  ctx: ContextoAnaliticas,
  antiguedad: AntiguedadTickets[],
): ResumenReparaciones {
  const filtrados = tickets.filter((t) => enRango(t.fechaISO, ctx.rango));
  const cobrado = cobradoReparaciones(movsCaja, movsCC, cajas, ctx.rango);
  const cobradoAnt = ctx.rangoAnterior
    ? cobradoReparaciones(movsCaja, movsCC, cajas, ctx.rangoAnterior)
    : null;

  const repuestosPorId = new Map(repuestos.map((r) => [r.id, r]));
  const ticketsCobrados = tickets.filter((t) => cobrado.ticketIds.has(t.id));
  const gastoRepuestos = ticketsCobrados.reduce((a, t) => {
    const usados = t.servicios.filter((s) => s.origen === "repuesto");
    return (
      a +
      usados.reduce((acc, s) => {
        const repuesto = s.repuestoId ? repuestosPorId.get(s.repuestoId) : undefined;
        return acc + (repuesto ? repuesto.costoUsd * (s.cantidad ?? 1) : 0);
      }, 0)
    );
  }, 0);

  return {
    cantidad: filtrados.length,
    cobrado,
    cobradoDelta: cobradoAnt
      ? deltaDe(cobrado.totalUsd, cobradoAnt.totalUsd)
      : undefined,
    gastoRepuestos,
    gananciaFinal: cobrado.totalUsd - gastoRepuestos,
    sinCotizacionReparaciones: cobrado.sinCotizacion,
    antiguedad,
    aceptacion: tasaAceptacion(filtrados),
    funnel: funnelTickets(filtrados),
    porFalla: ventasBrutasPorFalla(filtrados).slice(0, 8),
    actividadGrid: actividadTickets(filtrados),
  };
}

// ─────────────────────────── Finanzas ───────────────────────────

export type GastoCategoria = { categoria: string; monto: number; pct: number };
export type FlujoMes = {
  key: string;
  label: string;
  ingresos: number;
  egresos: number;
  neto: number;
  acumulado: number;
};
export type ComprasVentaMes = { key: string; label: string; ventas: number; compras: number };

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesCorto = (key: string) => {
  const [y, m] = key.split("-");
  return `${MESES_CORTOS[Number(m) - 1]} ${y.slice(2)}`;
};

export type ResumenFinanzas = {
  ingresosUsd: number;
  egresosUsd: number;
  netoUsd: number;
  gananciaVentas: number;
  deltas: { ingresos?: number; egresos?: number; neto?: number; ganancia?: number };
  sinCotizacion: SinCotizacion;
  porMedio: { label: string; pct: number; color: string; valueLabel: string }[];
  rentabilidadMes: RentabilidadMes[];
  margenPorTipo: MargenPorTipo[];
  flujoMes: FlujoMes[];
  gastosPorCategoria: { total: number; filas: GastoCategoria[] };
  comprasVentasMes: ComprasVentaMes[];
  cobertura: number | null;
};

function finanzasDe(
  movs: MovimientoCaja[],
  cajas: Caja[],
  rango: Rango,
): { ingresos: number; egresos: number; movs: MovimientoCaja[] } {
  const porId = new Map(cajas.map((c) => [c.id, c]));
  let ingresos = 0;
  let egresos = 0;
  const enRangoMovs = movs.filter((m) => enRango(m.fechaISO, rango));
  for (const m of enRangoMovs) {
    const caja = porId.get(m.cajaId);
    if (!caja) continue;
    const usd = movimientoEnUsd(m, caja);
    if (usd === null) continue;
    if (m.tipo === "ingreso") ingresos += usd;
    else egresos += usd;
  }
  return { ingresos, egresos, movs: enRangoMovs };
}

export function resumenFinanzas(
  ventas: Venta[],
  movs: MovimientoCaja[],
  cajas: Caja[],
  compras: Compra[],
  ctx: ContextoAnaliticas,
): ResumenFinanzas {
  const actual = finanzasDe(movs, cajas, ctx.rango);
  const anterior = ctx.rangoAnterior ? finanzasDe(movs, cajas, ctx.rangoAnterior) : null;
  const ingresosUsd = actual.ingresos;
  const egresosUsd = actual.egresos;
  const netoUsd = ingresosUsd - egresosUsd;

  const ventasFiltradas = ventas.filter((v) => enRango(v.fechaISO, ctx.rango));
  const margenTipo = margenPorTipo(ventasFiltradas);
  const gananciaVentas = margenTipo.reduce((a, r) => a + r.gananciaUsd, 0);

  const ventasAnt = ctx.rangoAnterior
    ? ventas.filter((v) => enRango(v.fechaISO, ctx.rangoAnterior as Rango))
    : [];
  const gananciaAnt = ctx.rangoAnterior
    ? margenPorTipo(ventasAnt).reduce((a, r) => a + r.gananciaUsd, 0)
    : undefined;

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
    label: medioPagoCfg[r.label as keyof typeof medioPagoCfg].label,
    value: r.value,
  }));
  const totalMedio = porMedio.reduce((a, r) => a + r.value, 0) || 1;
  const porMedioSlices = porMedio.map((r, i) => ({
    label: r.label,
    pct: Math.round((r.value / totalMedio) * 100),
    color: chartColor(i),
    valueLabel: `U$ ${Math.round(r.value).toLocaleString("es-AR")}`,
  }));

  const porId = new Map(cajas.map((c) => [c.id, c]));
  const flujoMes = (() => {
    const meses = new Map<string, { ingresos: number; egresos: number }>();
    for (const m of actual.movs) {
      const caja = porId.get(m.cajaId);
      if (!caja) continue;
      const usd = movimientoEnUsd(m, caja);
      if (usd === null) continue;
      const key = m.fechaISO.slice(0, 7);
      const fila = meses.get(key) ?? { ingresos: 0, egresos: 0 };
      if (m.tipo === "ingreso") fila.ingresos += usd;
      else fila.egresos += usd;
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

  const gastosPorCategoria = (() => {
    const totales = new Map<string, number>();
    for (const m of actual.movs) {
      if (m.tipo !== "egreso") continue;
      const caja = porId.get(m.cajaId);
      if (!caja) continue;
      const usd = movimientoEnUsd(m, caja);
      if (usd === null) continue;
      const categoria = m.categoria ? categoriaGastoCfg[m.categoria].label : "Sin categoría";
      totales.set(categoria, (totales.get(categoria) ?? 0) + usd);
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

  const comprasFiltradas = compras.filter((c) => enRango(c.fechaISO, ctx.rango));
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
  const totalVentasMes = comprasVentasMes.reduce((a, m) => a + m.ventas, 0);
  const totalComprasMes = comprasVentasMes.reduce((a, m) => a + m.compras, 0);
  const cobertura = totalComprasMes > 0 ? totalVentasMes / totalComprasMes : null;

  return {
    ingresosUsd,
    egresosUsd,
    netoUsd,
    gananciaVentas,
    deltas: {
      ingresos: deltaDe(ingresosUsd, anterior?.ingresos),
      egresos: deltaDe(egresosUsd, anterior?.egresos),
      neto: deltaDe(netoUsd, anterior ? anterior.ingresos - anterior.egresos : undefined),
      ganancia: deltaDe(gananciaVentas, gananciaAnt),
    },
    sinCotizacion: sinCotizacion(actual.movs, cajas),
    porMedio: porMedioSlices,
    rentabilidadMes: rentabilidadPorMes(ventasFiltradas),
    margenPorTipo: margenTipo,
    flujoMes,
    gastosPorCategoria,
    comprasVentasMes,
    cobertura,
  };
}

// ─────────────────────────── Inventario ───────────────────────────

export type ResumenInventario = {
  stockTodos: StockItem[];
  /** Foto cruda -- acotada al stock actual, la necesita `InventarioValor`. */
  equipos: Equipo[];
  repuestos: Repuesto[];
  otros: OtroItem[];
  valorInventario: number;
  unidadesStock: number;
  diasInventario: number | null;
  inmovilizado: number;
  pctInmovilizado: number;
  aging: ReturnType<typeof agingBuckets>;
  stockPorCat: Record<StockCategoria, { unidades: number; valor: number }>;
  unidadesSlices: { label: string; pct: number; color: string; valueLabel: string }[];
  entradas: Record<StockCategoria, number>;
  salidas: Record<StockCategoria, number>;
  bajas: number;
};

export function resumenInventario(
  equipos: Equipo[],
  repuestos: Repuesto[],
  otros: OtroItem[],
  movs: MovimientoStockBulk[],
  ventas: Venta[],
  tickets: Ticket[],
  ctx: ContextoAnaliticas,
): ResumenInventario {
  const stockTodos = stockItems(equipos, repuestos, otros, movs, ctx.hoy);
  const aging = agingBuckets(stockTodos);
  const valorInventario = stockTodos.reduce((a, i) => a + i.valorUsd, 0);
  const unidadesStock = stockTodos.reduce((a, i) => a + i.unidades, 0);
  const diasInventario = diasInventarioEquipos(movs, ventas);
  const inmovilizado = stockTodos
    .filter((i) => i.dias != null && i.dias > 90)
    .reduce((a, i) => a + i.valorUsd, 0);
  const pctInmovilizado = valorInventario > 0 ? (inmovilizado / valorInventario) * 100 : 0;

  const movsRango = movs.filter((m) => enRango(m.fechaISO, ctx.rango));
  const entradas: Record<StockCategoria, number> = { equipo: 0, repuesto: 0, otro: 0 };
  for (const m of movsRango) {
    if (m.tipo !== "ingreso") continue;
    if (m.itemTipo === "equipo") entradas.equipo += 1;
    else entradas[m.itemTipo] += unidadesDeMovimiento(m.detalle) ?? 0;
  }
  const ventasFiltradas = ventas.filter((v) => enRango(v.fechaISO, ctx.rango));
  const ticketsFiltrados = tickets.filter((t) => enRango(t.fechaISO, ctx.rango));
  const salidas: Record<StockCategoria, number> = { equipo: 0, repuesto: 0, otro: 0 };
  for (const v of ventasFiltradas) {
    for (const i of v.items) {
      if (i.categoria === "equipo") salidas.equipo += i.cantidad;
      if (i.categoria === "otro") salidas.otro += i.cantidad;
      for (const r of i.repuestos ?? []) salidas.repuesto += r.cantidad;
    }
  }
  for (const t of ticketsFiltrados) {
    for (const s of t.servicios) {
      if (s.origen === "repuesto" && s.repuestoId) salidas.repuesto += s.cantidad ?? 1;
    }
  }
  const bajas = movsRango.filter((m) => m.tipo === "baja").length;

  const stockPorCat = Object.fromEntries(
    STOCK_CATS.map((c) => [
      c,
      {
        unidades: stockTodos.filter((i) => i.categoria === c).reduce((a, i) => a + i.unidades, 0),
        valor: stockTodos.filter((i) => i.categoria === c).reduce((a, i) => a + i.valorUsd, 0),
      },
    ]),
  ) as Record<StockCategoria, { unidades: number; valor: number }>;

  const totalUnidadesStock =
    STOCK_CATS.reduce((a, c) => a + stockPorCat[c].unidades, 0) || 1;
  const unidadesSlices = STOCK_CATS.map((c, i) => ({
    label: CAT_STOCK_LABEL[c],
    pct: Math.round((stockPorCat[c].unidades / totalUnidadesStock) * 100),
    color: chartColor(i),
    valueLabel: `${stockPorCat[c].unidades} u`,
  }));

  return {
    stockTodos,
    equipos,
    repuestos,
    otros,
    valorInventario,
    unidadesStock,
    diasInventario,
    inmovilizado,
    pctInmovilizado,
    aging,
    stockPorCat,
    unidadesSlices,
    entradas,
    salidas,
    bajas,
  };
}

/** Ítems de stock que "piden atención" (>90 días), opcionalmente filtrados
 * por una celda del heatmap (rango de antigüedad × categoría). Se calcula en
 * el cliente porque depende de `celdaStock`, estado local de la pestaña. */
export function atencionInventario(
  stockTodos: StockItem[],
  celda: { rango: string; categoria: StockCategoria } | null,
): StockItem[] {
  return stockTodos
    .filter((i) => i.dias != null && i.dias > 90)
    .filter(
      (i) =>
        !celda ||
        (i.categoria === celda.categoria &&
          AGING_RANGOS.findIndex((r) => (i.dias as number) <= r.max) ===
            AGING_RANGOS.findIndex((r) => r.rango === celda.rango)),
    )
    .sort((a, b) => b.valorUsd - a.valorUsd)
    .slice(0, 8);
}

// ─────────────────────────── Clientes ───────────────────────────

export type ResumenClientes = {
  intel: ClienteIntel[];
  kpis: KpisClientes;
  cohortes: CohorteFila[];
  flujo: FlujoClientes;
  ranking: ProcedenciaRow[];
  ingresos: IngresoMes[];
  colores: { procedencia: string; color: string }[];
};

export function resumenClientes(
  clientes: Cliente[],
  ventas: Venta[],
  tickets: Ticket[],
  ctx: ContextoAnaliticas,
): ResumenClientes {
  const intel = clientesIntel(clientes, ventas, tickets, ctx.hoy);
  const ranking = procedenciaRanking(intel);
  let i = 0;
  const colores = ranking
    .filter((f) => f.label !== SIN_PROCEDENCIA)
    .map((f) => ({ procedencia: f.label, color: chartColor(i++) }));
  return {
    intel,
    kpis: kpisClientes(intel, ctx.hoy),
    cohortes: cohortesClientes(intel, ctx.hoy),
    flujo: flujoClientes(intel),
    ranking,
    ingresos: ingresosPorMesClientes(ventas, tickets, intel, ctx.hoy),
    colores,
  };
}

// ─────────────────────────── Turnos ───────────────────────────

export type ResumenTurnos = {
  total: number;
  confirmados: number;
  cancelados: number;
  pendientes: number;
  sinConfirmarPasados: number;
  tasaConfirmacion: number;
  porTipo: Row[];
  porEstado: Row[];
  porHora: Row[];
};

export function resumenTurnos(turnos: Turno[]): ResumenTurnos {
  const confirmados = turnos.filter((t) => t.estado === "confirmado").length;
  const cancelados = turnos.filter((t) => t.estado === "cancelado").length;
  const pendientes = turnos.filter((t) => t.estado === "pendiente").length;
  // `dayOffset` negativo = turno pasado (ver `listTurnosRango`).
  const sinConfirmarPasados = turnos.filter(
    (t) => t.estado === "pendiente" && t.dayOffset < 0,
  ).length;

  const tipos = ["compra", "deja", "retira", "cotizar"] as const;
  const estados = ["pendiente", "confirmado", "cancelado"] as const;
  const TIPO_LABEL: Record<(typeof tipos)[number], string> = {
    compra: "Compra equipo",
    deja: "Deja reparación",
    retira: "Retira reparación",
    cotizar: "Cotizar",
  };
  const ESTADO_LABEL: Record<(typeof estados)[number], string> = {
    pendiente: "Pendiente",
    confirmado: "Confirmado",
    cancelado: "Cancelado",
  };

  const porHora: Row[] = Array.from({ length: 12 }, (_, i) => {
    const h = `${String(i + 9).padStart(2, "0")}:00`;
    return { label: h, value: turnos.filter((t) => t.hora === h).length };
  });

  return {
    total: turnos.length,
    confirmados,
    cancelados,
    pendientes,
    sinConfirmarPasados,
    tasaConfirmacion: turnos.length > 0 ? (confirmados / turnos.length) * 100 : 0,
    porTipo: tipos.map((t) => ({
      label: TIPO_LABEL[t],
      value: turnos.filter((x) => x.tipo === t).length,
    })),
    porEstado: estados.map((e) => ({
      label: ESTADO_LABEL[e],
      value: turnos.filter((x) => x.estado === e).length,
    })),
    porHora,
  };
}
