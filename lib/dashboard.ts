import type { Equipo, Ticket, Turno, Venta, VentaItem } from "@/lib/types";
import type { DashPeriodo } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function esDelMes(fechaISO: string, anio: number, mes0: number): boolean {
  return fechaISO.slice(0, 4) === String(anio) && Number(fechaISO.slice(5, 7)) - 1 === mes0;
}

function mesAnterior(anio: number, mes0: number): { anio: number; mes0: number } {
  return mes0 === 0 ? { anio: anio - 1, mes0: 11 } : { anio, mes0: mes0 - 1 };
}

export type MetricaDashboard = {
  key: string;
  label: string;
  value: string;
  delta: number;
  deltaHint: string;
};

/** Las 6 métricas del dashboard, derivadas de ventas/tickets/equipos/turnos
 * reales. `delta` compara contra el mes anterior donde hay una base real de
 * comparación (facturado, margen, ticket promedio); para conteos puntuales
 * sin serie histórica (tickets abiertos, equipos en revisión, turnos hoy)
 * no hay con qué comparar todavía -- delta 0, no se fabrica una tendencia. */
export function metricasDashboard(params: {
  ventas: Venta[];
  ticketsAbiertos: number;
  equiposEnRevision: number;
  turnosHoy: number;
  hoy?: Date;
}): MetricaDashboard[] {
  const hoy = params.hoy ?? new Date();
  const anio = hoy.getFullYear();
  const mes0 = hoy.getMonth();
  const prev = mesAnterior(anio, mes0);

  const ventasMes = params.ventas.filter((v) => esDelMes(v.fechaISO, anio, mes0));
  const ventasMesPrev = params.ventas.filter((v) => esDelMes(v.fechaISO, prev.anio, prev.mes0));

  const totalMes = ventasMes.reduce((a, v) => a + v.totalUsd, 0);
  const totalMesPrev = ventasMesPrev.reduce((a, v) => a + v.totalUsd, 0);
  const deltaVentas = totalMesPrev > 0 ? ((totalMes - totalMesPrev) / totalMesPrev) * 100 : 0;

  const margenMes = ventasMes.length
    ? ventasMes.reduce((a, v) => a + v.margenPct, 0) / ventasMes.length
    : 0;
  const margenMesPrev = ventasMesPrev.length
    ? ventasMesPrev.reduce((a, v) => a + v.margenPct, 0) / ventasMesPrev.length
    : 0;
  const deltaMargen = margenMesPrev > 0 ? margenMes - margenMesPrev : 0;

  const ticketProm = ventasMes.length ? totalMes / ventasMes.length : 0;
  const ticketPromPrev = ventasMesPrev.length ? totalMesPrev / ventasMesPrev.length : 0;
  const deltaTicket =
    ticketPromPrev > 0 ? ((ticketProm - ticketPromPrev) / ticketPromPrev) * 100 : 0;

  return [
    { key: "ventas", label: "Ventas del mes", value: fmtUsd(totalMes), delta: round1(deltaVentas), deltaHint: "vs mes anterior" },
    { key: "margen", label: "Margen promedio", value: `${margenMes.toFixed(1)} %`, delta: round1(deltaMargen), deltaHint: "vs mes anterior" },
    { key: "abiertos", label: "Tickets abiertos", value: String(params.ticketsAbiertos), delta: 0, deltaHint: "sin entregar" },
    { key: "revision", label: "Equipos en revisión", value: String(params.equiposEnRevision), delta: 0, deltaHint: "en este momento" },
    { key: "ticket", label: "Ticket promedio", value: fmtUsd(Math.round(ticketProm)), delta: round1(deltaTicket), deltaHint: "vs mes anterior" },
    { key: "turnos", label: "Turnos hoy", value: String(params.turnosHoy), delta: 0, deltaHint: "agendados" },
  ];
}

export type ObjetivoMes = {
  current: number;
  dayOfMonth: number;
  daysInMonth: number;
  prevMes: string;
  prevTotal: number;
};

/** `current`/`prevTotal` reales (facturado del mes en curso y del anterior);
 * `target` (la meta) no tiene owner de configuración todavía -- sigue
 * viniendo de `monthGoal` en `lib/mock-data.ts`, se pasa aparte. */
export function objetivoDelMes(ventas: Venta[], hoy = new Date()): ObjetivoMes {
  const anio = hoy.getFullYear();
  const mes0 = hoy.getMonth();
  const prev = mesAnterior(anio, mes0);

  const current = ventas
    .filter((v) => esDelMes(v.fechaISO, anio, mes0))
    .reduce((a, v) => a + v.totalUsd, 0);
  const prevTotal = ventas
    .filter((v) => esDelMes(v.fechaISO, prev.anio, prev.mes0))
    .reduce((a, v) => a + v.totalUsd, 0);

  return {
    current,
    dayOfMonth: hoy.getDate(),
    daysInMonth: new Date(anio, mes0 + 1, 0).getDate(),
    prevMes: MESES[prev.mes0],
    prevTotal,
  };
}

function diasDelPeriodo(periodo: DashPeriodo, hoy: Date): Date[] {
  if (periodo === "quince") {
    return Array.from({ length: 15 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (14 - i));
      return d;
    });
  }
  const { anio, mes0 } =
    periodo === "mesPrevio" ? mesAnteriorFecha(hoy) : { anio: hoy.getFullYear(), mes0: hoy.getMonth() };
  const ultimoDia =
    periodo === "mesPrevio" ? new Date(anio, mes0 + 1, 0).getDate() : hoy.getDate();
  return Array.from({ length: ultimoDia }, (_, i) => new Date(anio, mes0, i + 1));
}

function mesAnteriorFecha(hoy: Date): { anio: number; mes0: number } {
  return mesAnterior(hoy.getFullYear(), hoy.getMonth());
}

function claveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Venta bruta y ganancia reales por día, para los 3 períodos del selector
 * del dashboard ("Este mes" = días 1..hoy; "Último mes" = mes calendario
 * completo anterior; "Últimos 15 días" = trailing). Arrays con longitud fija
 * por período (con ceros en los días sin ventas) para que el gráfico de
 * barras no cambie de ancho. Mismo cuidado con fechas que `lib/analiticas.ts`:
 * aritmética de `Date` local, nunca `.toISOString()`. */
export function ventaGananciaPorPeriodo(
  ventas: Venta[],
  hoy = new Date(),
): Record<DashPeriodo, { venta: number[]; ganancia: number[] }> {
  const totalesVenta = new Map<string, number>();
  const totalesGanancia = new Map<string, number>();
  for (const v of ventas) {
    const clave = v.fechaISO.slice(0, 10);
    totalesVenta.set(clave, (totalesVenta.get(clave) ?? 0) + v.totalUsd);
    totalesGanancia.set(clave, (totalesGanancia.get(clave) ?? 0) + v.totalUsd * (v.margenPct / 100));
  }

  const build = (periodo: DashPeriodo) => {
    const dias = diasDelPeriodo(periodo, hoy);
    return {
      venta: dias.map((d) => Math.round(totalesVenta.get(claveDia(d)) ?? 0)),
      ganancia: dias.map((d) => Math.round(totalesGanancia.get(claveDia(d)) ?? 0)),
    };
  };

  return { mes: build("mes"), mesPrevio: build("mesPrevio"), quince: build("quince") };
}

const RUBRO_LABEL: Record<NonNullable<VentaItem["categoria"]>, string> = {
  equipo: "Equipos",
  servicio: "Reparaciones",
  otro: "Accesorios",
  libre: "Otros",
};
const RUBRO_ORDEN = Object.keys(RUBRO_LABEL) as (keyof typeof RUBRO_LABEL)[];

/** Ventas de antes de trackear `VentaItem.categoria` sólo permiten inferir
 * con certeza el caso "equipo" (tiene `equipoId`); el resto cae en "Otros"
 * en vez de adivinar servicio/producto/libre. */
function categoriaDe(item: VentaItem): keyof typeof RUBRO_LABEL {
  return item.categoria ?? (item.equipoId ? "equipo" : "libre");
}

/** Mix real Equipos/Reparaciones/Accesorios/Otros por período del selector
 * del dashboard, a partir de `VentaItem.categoria`. */
export function ventasPorRubro(
  ventas: Venta[],
  hoy = new Date(),
): Record<DashPeriodo, { label: string; value: number }[]> {
  const build = (periodo: DashPeriodo) => {
    const dias = new Set(diasDelPeriodo(periodo, hoy).map(claveDia));
    const totales = new Map<string, number>();
    for (const v of ventas) {
      if (!dias.has(v.fechaISO.slice(0, 10))) continue;
      for (const item of v.items) {
        const cat = categoriaDe(item);
        totales.set(cat, (totales.get(cat) ?? 0) + item.precioUsd * item.cantidad);
      }
    }
    return RUBRO_ORDEN.map((cat) => ({
      label: RUBRO_LABEL[cat],
      value: Math.round(totales.get(cat) ?? 0),
    }));
  };
  return { mes: build("mes"), mesPrevio: build("mesPrevio"), quince: build("quince") };
}

export type VentaReciente = {
  id: string;
  cliente: string;
  item: string;
  categoria: string;
  vendedor: string;
  procedencia: string;
  monto: number;
  fecha: string;
};

/** Últimas `n` ventas reales para el widget "Ventas recientes". `categoria`
 * se deriva de `Venta.tipo` ('venta'/'reparacion' -> "Equipos"/"Reparaciones")
 * -- el schema real no distingue "Accesorios" como categoría separada, a
 * diferencia del mock. */
export function ventasRecientes(ventas: Venta[], n = 8): VentaReciente[] {
  return [...ventas]
    .sort((a, b) => b.fechaISO.localeCompare(a.fechaISO))
    .slice(0, n)
    .map((v) => ({
      id: v.id,
      cliente: v.cliente,
      item: v.items.map((i) => i.detalle).join(" + ") || "—",
      categoria: v.tipo === "venta" ? "Equipos" : "Reparaciones",
      vendedor: v.vendedor,
      procedencia: v.procedencia ?? "—",
      monto: v.totalUsd,
      fecha: v.fecha,
    }));
}
