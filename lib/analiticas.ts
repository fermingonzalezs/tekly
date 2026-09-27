import type { Equipo, OtroItem, Repuesto, Venta, Ticket, TicketStatus } from "@/lib/types";
import { RUBRO_LABEL, RUBRO_ORDEN, categoriaDe, type Rubro } from "@/lib/ventas";
import { otroValorStock } from "@/lib/otros";
import type { MovimientoStockBulk } from "@/lib/db/inventario";

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]; // orden de Date#getDay()

function claveDia(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Facturación real por mes, últimos `meses` meses (incluye el actual).
 * Meses sin ventas salen en 0 -- no se saltean, para que el gráfico de
 * barras siempre tenga el mismo ancho.
 *
 * `fechaISO` es siempre "YYYY-MM-DD": lo leemos con slice, nunca con
 * `new Date(iso)` -- ese constructor parsea como UTC medianoche, y leerlo
 * después con `.getMonth()` (hora local) corre la fecha un día para atrás
 * en cualquier huso horario negativo (Argentina incluida). */
export function ventasPorMes(
  ventas: Venta[],
  meses = 6,
  hoy = new Date(),
): { mes: string; usd: number }[] {
  const totales = new Map<string, number>();
  for (const v of ventas) {
    const clave = v.fechaISO.slice(0, 7); // "YYYY-MM"
    totales.set(clave, (totales.get(clave) ?? 0) + v.totalUsd);
  }
  const out: { mes: string; usd: number }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ mes: MESES[d.getMonth()], usd: totales.get(clave) ?? 0 });
  }
  return out;
}

/** Facturación real por día, últimos `dias` días (incluye hoy) -- para el
 * gráfico de "facturación acumulada". Mismo cuidado que `ventasPorMes`:
 * las claves de día se arman con aritmética local, nunca `.toISOString()`
 * (esa sí vuelve a UTC y puede correr un día en husos positivos). */
export function facturacionDiaria(ventas: Venta[], dias = 14, hoy = new Date()): number[] {
  const totales = new Map<string, number>();
  for (const v of ventas) {
    totales.set(v.fechaISO.slice(0, 10), (totales.get(v.fechaISO.slice(0, 10)) ?? 0) + v.totalUsd);
  }
  const out: number[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    out.push(totales.get(claveDia(d.getFullYear(), d.getMonth(), d.getDate())) ?? 0);
  }
  return out;
}

export type RubroMes = { mes: string } & Record<Rubro, number>;

/** Facturación real por mes y por rubro, últimos `meses` meses (incluye el
 * actual) -- mismo `categoriaDe` que `margenPorTipo`/`ventasPorRubro`
 * (dashboard), una sola fuente de verdad para qué es cada rubro. Alimenta
 * `TendenciaRubros`. Mismo cuidado de husos horarios que `ventasPorMes`
 * (`fechaISO` se lee con `.slice()`, nunca con `new Date(iso)`). */
export function ventasPorRubroMes(
  ventas: Venta[],
  meses = 6,
  hoy = new Date(),
): RubroMes[] {
  const vacio = (): Record<Rubro, number> => ({ equipo: 0, servicio: 0, otro: 0, libre: 0 });
  const totales = new Map<string, Record<Rubro, number>>();
  for (const v of ventas) {
    const clave = v.fechaISO.slice(0, 7); // "YYYY-MM"
    const acc = totales.get(clave) ?? vacio();
    for (const item of v.items) {
      const cat = categoriaDe(item);
      acc[cat] += item.precioUsd * item.cantidad;
    }
    totales.set(clave, acc);
  }
  const out: RubroMes[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ mes: MESES[d.getMonth()], ...(totales.get(clave) ?? vacio()) });
  }
  return out;
}

export type VentaDia = { dia: string; usd: number; operaciones: number };

/** Facturación real por día de la semana (Lun a Dom), sobre el conjunto de
 * ventas que se le pase (respeta el filtro de fecha de la pestaña Ventas
 * si se lo llama con `ventasFiltradas`). `fechaISO` se arma en `Date(y, m-1,
 * d)` -- construcción local a propósito, nunca `new Date(iso).getDay()`
 * (ese constructor parsea la fecha como UTC medianoche, y `getDay()` la lee
 * en hora local -- mismo bug de huso horario que ya nos mordió en
 * `ventasPorMes`/`facturacionDiaria`). */
export function ventasPorDiaSemana(ventas: Venta[]): VentaDia[] {
  const totales = Array.from({ length: 7 }, () => ({ usd: 0, operaciones: 0 }));
  for (const v of ventas) {
    const [y, m, d] = v.fechaISO.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    totales[dow].usd += v.totalUsd;
    totales[dow].operaciones += 1;
  }
  const orden = [1, 2, 3, 4, 5, 6, 0]; // Lun..Dom
  return orden.map((i) => ({
    dia: DIAS_SEMANA[i],
    usd: Math.round(totales[i].usd),
    operaciones: totales[i].operaciones,
  }));
}

export type MargenPorTipo = {
  tipo: string;
  operaciones: number;
  margenPct: number;
  gananciaUsd: number;
  /** Facturación con costo cargado (la base del margen) -- para el scatter
   * de "Margen vs facturación" y el waterfall de resultado. */
  facturacionUsd: number;
};

/** Margen real por rubro (mismo `categoriaDe` que `ventasPorRubro` del
 * dashboard -- una sola fuente de verdad), todo el historial de ventas.
 * `VentaItem.costoUsd` es opcional: un ítem sin costo cargado no entra en
 * el cálculo de margen (ni en ingreso ni en ganancia), pero sí cuenta como
 * operación -- así un rubro con costos sin cargar no queda con margen 0
 * artificial, muestra el margen real de lo que sí tiene costo. */
export function margenPorTipo(ventas: Venta[]): MargenPorTipo[] {
  const operaciones = new Map<string, number>();
  const ingreso = new Map<string, number>();
  const ganancia = new Map<string, number>();

  for (const v of ventas) {
    for (const item of v.items) {
      const cat = categoriaDe(item);
      operaciones.set(cat, (operaciones.get(cat) ?? 0) + 1);
      if (item.costoUsd === undefined) continue;
      ingreso.set(cat, (ingreso.get(cat) ?? 0) + item.precioUsd * item.cantidad);
      ganancia.set(
        cat,
        (ganancia.get(cat) ?? 0) + (item.precioUsd - item.costoUsd) * item.cantidad,
      );
    }
  }

  return RUBRO_ORDEN.map((cat) => {
    const ing = ingreso.get(cat) ?? 0;
    const gan = ganancia.get(cat) ?? 0;
    return {
      tipo: RUBRO_LABEL[cat],
      operaciones: operaciones.get(cat) ?? 0,
      margenPct: ing > 0 ? Math.round((gan / ing) * 1000) / 10 : 0,
      gananciaUsd: Math.round(gan),
      facturacionUsd: Math.round(ing),
    };
  });
}

export type RentabilidadMes = {
  mes: string;
  facturacion: number;
  ganancia: number;
  margenPct: number;
};

/** Evolución mensual de la rentabilidad: facturación total (`totalUsd`,
 * misma base que el KPI) contra ganancia real (mismo criterio de costo que
 * `margenPorTipo`: ítems sin costo no generan ganancia). El margen % del
 * mes es ganancia sobre facturación total -- conservador si hay ítems sin
 * costo cargado, nunca mayor a 100. Meses sin ventas van en 0 para que la
 * línea no saltee períodos. Mismo cuidado de huso horario que
 * `ventasPorMes`. */
export function rentabilidadPorMes(
  ventas: Venta[],
  meses = 6,
  hoy = new Date(),
): RentabilidadMes[] {
  const totales = new Map<string, { facturacion: number; ganancia: number }>();
  for (const v of ventas) {
    const clave = v.fechaISO.slice(0, 7); // "YYYY-MM"
    const acc = totales.get(clave) ?? { facturacion: 0, ganancia: 0 };
    acc.facturacion += v.totalUsd;
    for (const item of v.items) {
      if (item.costoUsd === undefined) continue;
      acc.ganancia += (item.precioUsd - item.costoUsd) * item.cantidad;
    }
    totales.set(clave, acc);
  }
  const out: RentabilidadMes[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const t = totales.get(clave) ?? { facturacion: 0, ganancia: 0 };
    out.push({
      mes: MESES[d.getMonth()],
      facturacion: Math.round(t.facturacion),
      ganancia: Math.round(t.ganancia),
      margenPct:
        t.facturacion > 0
          ? Math.round((t.ganancia / t.facturacion) * 1000) / 10
          : 0,
    });
  }
  return out;
}

export type VentasPorFalla = { falla: string; totalUsd: number; tickets: number };

/** Presupuestado (`presupuestoUsd`) por tipo de falla, ranking de mayor a
 * menor. A diferencia de un conteo simple, pesa cada falla por lo que
 * factura de verdad -- una falla poco frecuente pero cara puede pesar más
 * que una habitual y barata. Incluye tickets en cualquier estado:
 * `presupuestoUsd` ya es la suma de los ítems cargados, no depende de haberse
 * entregado. */
export function ventasBrutasPorFalla(tickets: Ticket[]): VentasPorFalla[] {
  const totales = new Map<string, { totalUsd: number; tickets: number }>();
  for (const t of tickets) {
    const falla = t.falla.trim() || "Sin especificar";
    const cur = totales.get(falla) ?? { totalUsd: 0, tickets: 0 };
    cur.totalUsd += t.presupuestoUsd;
    cur.tickets += 1;
    totales.set(falla, cur);
  }
  return Array.from(totales.entries())
    .map(([falla, v]) => ({ falla, totalUsd: Math.round(v.totalUsd), tickets: v.tickets }))
    .sort((a, b) => b.totalUsd - a.totalUsd);
}

const ANTIGUEDAD_RANGOS: { rango: string; maxDias: number }[] = [
  { rango: "0-3 días", maxDias: 3 },
  { rango: "4-7 días", maxDias: 7 },
  { rango: "8-15 días", maxDias: 15 },
  { rango: "16-30 días", maxDias: 30 },
  { rango: "+30 días", maxDias: Infinity },
];

export type AntiguedadTickets = { rango: string; tickets: number };

/** Distribución de antigüedad (días desde el ingreso) de los tickets que
 * todavía no se entregaron -- proxy real de "cuánto está tardando" sin
 * necesitar un timestamp de cierre (`tickets` no lo tiene, ver "Estado de la
 * migración" en CLAUDE.md). Mismo cuidado de huso horario que el resto del
 * archivo: `fechaISO` se arma con `Date(y, m-1, d)` local, nunca
 * `new Date(iso)`. */
export function antiguedadTicketsAbiertos(
  tickets: Ticket[],
  hoy = new Date(),
): AntiguedadTickets[] {
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  const counts = ANTIGUEDAD_RANGOS.map(() => 0);
  for (const t of tickets) {
    if (t.estado === "entregado") continue;
    const [y, m, d] = t.fechaISO.split("-").map(Number);
    const dias = Math.floor((hoyLocal - new Date(y, m - 1, d).getTime()) / 86_400_000);
    const idx = ANTIGUEDAD_RANGOS.findIndex((r) => dias <= r.maxDias);
    counts[idx]++;
  }
  return ANTIGUEDAD_RANGOS.map((r, i) => ({ rango: r.rango, tickets: counts[i] }));
}

export type TicketsDia = { dia: string; tickets: number };

/** Tickets ingresados por día de la semana (Lun a Dom) -- mismo patrón que
 * `ventasPorDiaSemana`, mismo cuidado de huso horario. */
export function ticketsPorDiaSemana(tickets: Ticket[]): TicketsDia[] {
  const totales = Array.from({ length: 7 }, () => 0);
  for (const t of tickets) {
    const [y, m, d] = t.fechaISO.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    totales[dow] += 1;
  }
  const orden = [1, 2, 3, 4, 5, 6, 0]; // Lun..Dom
  return orden.map((i) => ({ dia: DIAS_SEMANA[i], tickets: totales[i] }));
}

// ── Reparaciones: embudo de estados y aceptación ───────

/** Línea principal del flujo (`TICKET_FLOW` de lib/status.ts sin la rama
 * `esperando_repuesto`: esperar el repuesto es parte de la fase de
 * reparación, no un paso propio del embudo). */
const FUNNEL_ETAPAS: TicketStatus[] = [
  "recibido",
  "diagnosticado",
  "presupuestado",
  "aprobado",
  "en_reparacion",
  "listo",
  "entregado",
];

export type FunnelEtapa = {
  estado: TicketStatus;
  /** Tickets parados exactamente en esta etapa ahora. */
  ahora: number;
  /** Tickets que alcanzaron esta etapa o más allá. */
  alcanzados: number;
};

/** Embudo de reparaciones sobre los estados reales del flujo: la caída
 * entre etapas consecutivas marca dónde se acumula el trabajo. La rama
 * `esperando_repuesto` se computa dentro de "en_reparacion". */
export function funnelTickets(tickets: Ticket[]): FunnelEtapa[] {
  const exactos = new Map<TicketStatus, number>(FUNNEL_ETAPAS.map((e) => [e, 0]));
  for (const t of tickets) {
    const etapa = t.estado === "esperando_repuesto" ? "en_reparacion" : t.estado;
    exactos.set(etapa, (exactos.get(etapa) ?? 0) + 1);
  }
  const etapas = FUNNEL_ETAPAS.map((estado) => ({
    estado,
    ahora: exactos.get(estado) ?? 0,
    alcanzados: 0,
  }));
  let acum = 0;
  for (let i = etapas.length - 1; i >= 0; i--) {
    acum += etapas[i].ahora;
    etapas[i].alcanzados = acum;
  }
  return etapas;
}

export type TasaAceptacion = {
  presupuestadas: number;
  aceptadas: number;
  /** 0..100; 0 sin datos (evita NaN). */
  pct: number;
};

/** Tasa de aceptación de presupuestos: de los tickets cotizados (llegaron a
 * "Presupuestado"), cuántos avanzaron a "Aprobado". No existe estado
 * "rechazado" -- los que siguen en `presupuestado` están pendientes de
 * decisión y entran al denominador. */
export function tasaAceptacion(tickets: Ticket[]): TasaAceptacion {
  const f = funnelTickets(tickets);
  const de = (e: TicketStatus) => f.find((x) => x.estado === e)?.alcanzados ?? 0;
  const presupuestadas = de("presupuestado");
  const aceptadas = de("aprobado");
  return {
     presupuestadas,
     aceptadas,
     pct: presupuestadas > 0 ? (aceptadas / presupuestadas) * 100 : 0,
   };
}

// ── Inventario: stock vivo, antigüedad y rotación ───────
//
// Los ítems no tienen fecha de ingreso propia (Equipo/Repuesto/OtroItem no
// la guardan): la antigüedad se reconstruye de los movimientos de stock,
// que registran cada ingreso/egreso/baja por ítem. El egreso real de un
// equipo es su venta (los movimientos "egreso" son de repuestos usados en
// ventas), así que la rotación de equipos se mide ingreso → fecha de venta.

export type StockCategoria = "equipo" | "repuesto" | "otro";

/** Orden fijo de las categorías de inventario -- mismo rol que
 * `RUBRO_ORDEN` para ventas: mismo orden ⇒ mismo tono (`chartColor`) y
 * mismo label en toda la sección. */
export const STOCK_CATS: StockCategoria[] = ["equipo", "repuesto", "otro"];

export const CAT_STOCK_LABEL: Record<StockCategoria, string> = {
  equipo: "Equipos",
  repuesto: "Repuestos",
  otro: "Accesorios",
};

/** Un ítem de stock "vivo" (equipo no vendido, repuesto/otro con stock)
 * con todo lo que necesitan los charts de la pestaña: unidades, valor a
 * costo (misma base que `InventarioValor`), margen de venta potencial y
 * días en stock según los movimientos. */
export type StockItem = {
  categoria: StockCategoria;
  id: string;
  nombre: string;
  unidades: number;
  valorUsd: number;
  /** Margen de venta potencial. Repuestos: null -- no tienen precio de
   * venta propio (se carga a mano en cada ticket/venta). */
  margenPct: number | null;
  /** Días desde el ingreso (equipos: primer ingreso, son unidades únicas;
   * repuestos/otros: último ingreso, aproxima la antigüedad de la tanda
   * actual). Null si el ítem no tiene ningún registro de ingreso
   * (anteriores a los movimientos de stock). */
  dias: number | null;
};

/** Días entre una fechaISO y hoy. Parseo local seguro (ver nota de
 * `ventasPorMes`: nunca `new Date(iso)`, que corre un día en UTC−3). */
function diasDesdeISO(iso: string, hoy: Date): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor((hoy.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
}

/** Días entre dos fechasISO (b − a), mismo parseo local. */
function diasEntreISO(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86_400_000,
  );
}

export function stockItems(
  equipos: Equipo[],
  repuestos: Repuesto[],
  otros: OtroItem[],
  movs: MovimientoStockBulk[],
  hoy = new Date(),
): StockItem[] {
  // primer/último ingreso por ítem -- llegan ordenados por fecha, pero no
  // depender de eso: el último siempre gana
  const primerIngreso = new Map<string, string>();
  const ultimoIngreso = new Map<string, string>();
  for (const m of movs) {
    if (m.tipo !== "ingreso") continue;
    const clave = `${m.itemTipo}:${m.itemId}`;
    if (!primerIngreso.has(clave)) primerIngreso.set(clave, m.fechaISO);
    ultimoIngreso.set(clave, m.fechaISO);
  }
  const items: StockItem[] = [];
  for (const e of equipos) {
    // mismo criterio "en stock" que InventarioValor: todo lo no vendido
    if (e.estado === "vendido") continue;
    const fecha = primerIngreso.get(`equipo:${e.id}`);
    items.push({
      categoria: "equipo",
      id: e.id,
      nombre: `${e.modelo} ${e.almacenamiento}`.trim(),
      unidades: 1,
      valorUsd: e.costoUsd,
      margenPct: e.precioUsd > 0 ? ((e.precioUsd - e.costoUsd) / e.precioUsd) * 100 : null,
      dias: fecha ? diasDesdeISO(fecha, hoy) : null,
    });
  }
  for (const r of repuestos) {
    if (r.stock <= 0) continue;
    const fecha = ultimoIngreso.get(`repuesto:${r.id}`);
    items.push({
      categoria: "repuesto",
      id: r.id,
      nombre: r.modelo ? `${r.nombre} · ${r.modelo}` : r.nombre,
      unidades: r.stock,
      valorUsd: r.stock * r.costoUsd,
      margenPct: null,
      dias: fecha ? diasDesdeISO(fecha, hoy) : null,
    });
  }
  for (const o of otros) {
    const unidades = o.serializado ? o.unidades.length : o.cantidad;
    if (unidades <= 0) continue;
    // costo unitario: serializado promedia las unidades (pueden entrar en
    // tandas de distinto costo), el resto ya es por unidad
    const costoUnitario = o.serializado ? otroValorStock(o) / unidades : o.costoUsd;
    const fecha = ultimoIngreso.get(`otro:${o.id}`);
    items.push({
      categoria: "otro",
      id: o.id,
      nombre: o.nombre,
      unidades,
      valorUsd: costoUnitario * unidades,
      margenPct: o.precioUsd > 0 ? ((o.precioUsd - costoUnitario) / o.precioUsd) * 100 : null,
      dias: fecha ? diasDesdeISO(fecha, hoy) : null,
    });
  }
  return items;
}

export const AGING_RANGOS = [
  { rango: "0-30", max: 30 },
  { rango: "31-60", max: 60 },
  { rango: "61-90", max: 90 },
  { rango: "91-180", max: 180 },
  { rango: "180+", max: Number.POSITIVE_INFINITY },
] as const;

export type AgingCelda = { unidades: number; valor: number; productos: number };

/** Antigüedad del stock en rangos: unidades, valor a costo y cantidad de
 * productos, total y por categoría -- alimenta el anillo y el heatmap.
 * Ítems sin registro de ingreso quedan afuera: no hay forma honesta de
 * ubicarlos en un rango. */
export function agingBuckets(items: StockItem[]): {
  rango: string;
  total: AgingCelda;
  porCategoria: Record<StockCategoria, AgingCelda>;
}[] {
  const vacia = (): AgingCelda => ({ unidades: 0, valor: 0, productos: 0 });
  const buckets = AGING_RANGOS.map((r) => ({
    rango: r.rango as string,
    total: vacia(),
    porCategoria: { equipo: vacia(), repuesto: vacia(), otro: vacia() },
  }));
  for (const it of items) {
    if (it.dias == null) continue;
    const i = AGING_RANGOS.findIndex((r) => it.dias! <= r.max);
    if (i < 0) continue; // "180+" atrapa todo, defensivo
    const b = buckets[i];
    b.total.unidades += it.unidades;
    b.total.valor += it.valorUsd;
    b.total.productos += 1;
    const c = b.porCategoria[it.categoria];
    c.unidades += it.unidades;
    c.valor += it.valorUsd;
    c.productos += 1;
  }
  return buckets;
}

/** Promedio de días que tardó un equipo en salir del inventario, del
 * recorrido real (primer ingreso → fecha de venta). Solo equipos: son
 * unidades únicas rastreables de punta a punta; el stock de
 * repuestos/otros mezcla tandas. Null sin ningún recorrido completo. */
export function diasInventarioEquipos(
  movs: MovimientoStockBulk[],
  ventas: Venta[],
): number | null {
  const primerIngreso = new Map<string, string>();
  for (const m of movs) {
    if (m.itemTipo === "equipo" && m.tipo === "ingreso" && !primerIngreso.has(m.itemId)) {
      primerIngreso.set(m.itemId, m.fechaISO);
    }
  }
  const ventaDeEquipo = new Map<string, string>();
  for (const v of ventas) {
    for (const i of v.items) {
      if (i.equipoId && !ventaDeEquipo.has(i.equipoId)) ventaDeEquipo.set(i.equipoId, v.fechaISO);
    }
  }
  const dias: number[] = [];
  for (const [id, ingreso] of primerIngreso) {
    const venta = ventaDeEquipo.get(id);
    if (!venta) continue;
    const d = diasEntreISO(ingreso, venta);
    if (d >= 0) dias.push(d);
  }
  return dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : null;
}

/** Unidades que registra el detalle de un movimiento de repuesto/otro
 * ("Ingreso: +3 unidades", "Usado en venta V-12: -2 unidades"). Equipos no
 * lo necesitan (unidad única). Null si el detalle no trae cantidad. */
export function unidadesDeMovimiento(detalle: string): number | null {
  const m = /[+-]\s?(\d+)\s?unidades/.exec(detalle);
  return m ? Number(m[1]) : null;
}

