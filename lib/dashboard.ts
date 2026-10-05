import type { Equipo, Ticket, TicketStatus, Turno, Venta } from "@/lib/types";
import type { DashPeriodo } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";
import { RUBRO_LABEL, RUBRO_ORDEN, categoriaDe, margenPonderado } from "@/lib/ventas";
import { TICKET_FLOW } from "@/lib/status";

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

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
  /** Variación vs el mes anterior -- `undefined` para conteos puntuales
   * (tickets abiertos, turnos hoy): sin serie histórica no hay con qué
   * comparar y el chip "+0.0%" parece un dato que no lo es. */
  delta?: number;
  deltaHint: string;
  /** La métrica principal del dashboard ("Ventas del mes" en admin, la
   * primera del empleado): ocupa 2 columnas y va sobre `bg-accent`. */
  destacada?: boolean;
};

/** Las 5 métricas del dashboard, derivadas de ventas/tickets/turnos reales.
 * `delta` compara contra el mes anterior donde hay una base real de
 * comparación (facturado, margen, ticket promedio); para conteos puntuales
 * sin serie histórica (tickets abiertos, turnos hoy) no hay con qué
 * comparar todavía -- delta 0, no se fabrica una tendencia. */
export function metricasDashboard(params: {
  ventas: Venta[];
  ticketsAbiertos: number;
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

  // Ponderado por facturación y solo ítems con costo (`margenPonderado`)
  // -- el promedio simple de `margenPct` hacía que una venta de U$ 20
  // pesara igual que una de U$ 2.000, y contaba los ítems sin costo como
  // margen 100 %. `null` = ningún ítem con costo cargado ("sin dato").
  const margenMes = margenPonderado(ventasMes);
  const margenMesPrev = margenPonderado(ventasMesPrev);
  const deltaMargen =
    margenMes !== null && margenMesPrev !== null && margenMesPrev > 0
      ? margenMes - margenMesPrev
      : undefined;

  const ticketProm = ventasMes.length ? totalMes / ventasMes.length : 0;
  const ticketPromPrev = ventasMesPrev.length ? totalMesPrev / ventasMesPrev.length : 0;
  const deltaTicket =
    ticketPromPrev > 0 ? ((ticketProm - ticketPromPrev) / ticketPromPrev) * 100 : 0;

  return [
    { key: "ventas", label: "Ventas del mes", value: fmtUsd(totalMes), delta: round1(deltaVentas), deltaHint: "vs mes anterior", destacada: true },
    { key: "margen", label: "Margen promedio", value: margenMes !== null ? `${margenMes.toFixed(1)} %` : "—", ...(deltaMargen !== undefined ? { delta: round1(deltaMargen) } : {}), deltaHint: "vs mes anterior" },
    { key: "abiertos", label: "Tickets abiertos", value: String(params.ticketsAbiertos), deltaHint: "sin entregar" },
    { key: "ticket", label: "Ticket promedio", value: fmtUsd(Math.round(ticketProm)), delta: round1(deltaTicket), deltaHint: "vs mes anterior" },
    { key: "turnos", label: "Turnos hoy", value: String(params.turnosHoy), deltaHint: "agendados" },
  ];
}

/** KPIs del dashboard de empleado (vendedor o técnico). Se calcula y se
 * consume en el server (`page.tsx`) -- al empleado no se le pasa ni
 * ganancia, margen, costos ni el objetivo de la org (ver plan 005). */
export function metricasEmpleado(params: {
  ventas: Venta[];
  tickets: Ticket[];
  turnos: Turno[];
  userId: string;
  rol: "vendedor" | "tecnico";
  hoy?: Date;
}): MetricaDashboard[] {
  const hoy = params.hoy ?? new Date();
  const prev = mesAnterior(hoy.getFullYear(), hoy.getMonth());

  const turnosHoy = params.turnos.filter(
    (t) => t.dayOffset === 0 && t.estado !== "cancelado",
  ).length;

  if (params.rol === "vendedor") {
    const mias = params.ventas.filter((v) => v.vendedorId === params.userId);
    const mes = mias.filter((v) => esDelMes(v.fechaISO, hoy.getFullYear(), hoy.getMonth()));
    const mesPrev = mias.filter((v) => esDelMes(v.fechaISO, prev.anio, prev.mes0));
    const totalMes = mes.reduce((a, v) => a + v.totalUsd, 0);
    const totalPrev = mesPrev.reduce((a, v) => a + v.totalUsd, 0);
    const delta = totalPrev > 0 ? ((totalMes - totalPrev) / totalPrev) * 100 : 0;
    // Listos para retirar de TODA la org: el vendedor es quien entrega en
    // mostrador (ver plan 005).
    const listos = params.tickets.filter((t) => t.estado === "listo").length;
    return [
      { key: "mis-ventas", label: "Mis ventas del mes", value: fmtUsd(totalMes), delta: round1(delta), deltaHint: "vs mes anterior", destacada: true },
      { key: "mis-operaciones", label: "Mis operaciones", value: String(mes.length), deltaHint: "del mes" },
      { key: "listos-retirar", label: "Listos para retirar", value: String(listos), deltaHint: "para entregar" },
      { key: "turnos", label: "Turnos hoy", value: String(turnosHoy), deltaHint: "agendados" },
    ];
  }

  const mios = params.tickets.filter((t) => t.tecnicoId === params.userId);
  const abiertos = mios.filter((t) => t.estado !== "entregado").length;
  const esperando = mios.filter((t) => t.estado === "esperando_repuesto").length;
  // "Listos esta semana": quedaron `listo` con ingreso desde el lunes -- no
  // hay timestamp del cambio de estado, el ingreso es la fecha disponible.
  const listosSemana = mios.filter(
    (t) => t.estado === "listo" && esDeEstaSemana(t.fechaISO, hoy),
  ).length;
  return [
    { key: "mis-abiertos", label: "Mis tickets abiertos", value: String(abiertos), deltaHint: "sin entregar", destacada: true },
    { key: "esperando-repuesto", label: "Esperando repuesto", value: String(esperando), deltaHint: "míos" },
    { key: "listos-semana", label: "Listos esta semana", value: String(listosSemana), deltaHint: "míos" },
    { key: "turnos", label: "Turnos hoy", value: String(turnosHoy), deltaHint: "agendados" },
  ];
}

/** `fechaISO` (YYYY-MM-DD) cae entre el lunes de la semana de `hoy` y `hoy`
 * -- comparación de strings, sin `new Date(iso)` (huso horario). */
function esDeEstaSemana(fechaISO: string, hoy: Date): boolean {
  const lunes = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate() - ((hoy.getDay() + 6) % 7),
  );
  return fechaISO.slice(0, 10) >= claveDia(lunes) && fechaISO.slice(0, 10) <= claveDia(hoy);
}

export type TicketTecnico = {
  id: number;
  equipo: string;
  estado: TicketStatus;
};

/** Tickets abiertos del técnico para "Mis tickets" (dashboard de empleado):
 * ordenados por estado según `TICKET_FLOW` y luego por ingreso más reciente. */
export function ticketsDeTecnico(
  tickets: Ticket[],
  tecnicoId: string,
  n = 8,
): TicketTecnico[] {
  return tickets
    .filter((t) => t.tecnicoId === tecnicoId && t.estado !== "entregado")
    .sort(
      (a, b) =>
        TICKET_FLOW.indexOf(a.estado) - TICKET_FLOW.indexOf(b.estado) ||
        b.fechaISO.localeCompare(a.fechaISO),
    )
    .slice(0, n)
    .map((t) => ({ id: t.id, equipo: t.equipo, estado: t.estado }));
}

export type ObjetivoMes = {
  current: number;
  dayOfMonth: number;
  daysInMonth: number;
  prevMes: string;
  prevTotal: number;
};

/** `current`/`prevTotal` reales (facturado del mes en curso y del anterior).
 * `target` (la meta) también es real pero no sale de acá -- es
 * `organizations.objetivo_mes_usd` (`getNegocio()` en
 * `lib/db/configuracion.ts`), se pasa aparte como `objetivoTarget`. */
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
 * barras no cambie de ancho, y `fechas` (ISO `YYYY-MM-DD`, mismo largo) para
 * el eje X y el tooltip con fechas reales. Mismo cuidado con fechas que
 * `lib/analiticas.ts`: aritmética de `Date` local, nunca `.toISOString()`. */
export function ventaGananciaPorPeriodo(
  ventas: Venta[],
  hoy = new Date(),
): Record<DashPeriodo, { venta: number[]; ganancia: number[]; fechas: string[] }> {
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
      fechas: dias.map(claveDia),
    };
  };

  return { mes: build("mes"), mesPrevio: build("mesPrevio"), quince: build("quince") };
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
  monto: number;
  /** Tiempo relativo ("hoy" / "ayer" / "hace 3 d" / "4 oct") -- se calcula
   * contra el `hoy` del server para que SSR e hidratación coincidan. */
  hace: string;
  vendedor: string;
};

/** Últimas `n` ventas reales para el widget "Ventas recientes". `hace` se
 * calcula acá (server) contra `hoy` -- no hay hora en `Venta.fechaISO` (solo
 * fecha), la granularidad es por día. */
export function ventasRecientes(
  ventas: Venta[],
  n = 8,
  hoy = new Date(),
): VentaReciente[] {
  return [...ventas]
    .sort((a, b) => b.fechaISO.localeCompare(a.fechaISO))
    .slice(0, n)
    .map((v) => ({
      id: v.id,
      cliente: v.cliente,
      item: v.items.map((i) => i.detalle).join(" + ") || "—",
      monto: v.totalUsd,
      hace: tiempoRelativo(v.fechaISO, hoy),
      vendedor: v.vendedor,
    }));
}

/** "hoy" / "ayer" / "hace 3 d" / "4 oct" -- `fechaISO` parseado con `.slice()`
 * y `Date` local, nunca `new Date(iso)` (huso horario). */
export function tiempoRelativo(fechaISO: string, hoy: Date): string {
  const fecha = new Date(
    Number(fechaISO.slice(0, 4)),
    Number(fechaISO.slice(5, 7)) - 1,
    Number(fechaISO.slice(8, 10)),
  );
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dias = Math.round((base.getTime() - fecha.getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} d`;
  return `${Number(fechaISO.slice(8, 10))} ${MESES[Number(fechaISO.slice(5, 7)) - 1]}`;
}

/** Partes de un ISO `YYYY-MM-DD` para etiquetas de ejes/tooltips. El día de
 * semana viaja por `Date.UTC` + `getUTCDay` (seguro en cualquier huso). */
export function fechaPartes(iso: string): { dow: string; dia: number; mes: string } {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return {
    dow: DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()],
    dia: d,
    mes: MESES[m - 1],
  };
}

/** "lun 13 oct" -- fecha corta con día de semana para tooltips. */
export function fechaCorta(iso: string): string {
  const p = fechaPartes(iso);
  return `${p.dow} ${p.dia} ${p.mes}`;
}
