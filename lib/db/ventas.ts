import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { fmtDayMonth } from "@/lib/format";
import { addMovimiento } from "@/lib/db/inventario";
import { createMovimientoCC } from "@/lib/db/cuentas-corrientes";
import { createCompra } from "@/lib/db/compras";
import { montoConRecargo, resumenDeVentas, graficosDeVentas, type ResumenVentas, type Rubro, type GraficosVentas } from "@/lib/ventas";
import { rangoDe, type FiltrosVentas } from "@/lib/ventas-filtros";
import { sumarDias, type Rango } from "@/lib/date-presets";
import { PAGE_SIZE } from "@/lib/pagination";
import type { CanjeEquipo, ModalidadVenta, Pago, Venta, VentaItem } from "@/lib/types";

/** Cantidad de ventas por procedencia (canal) -- usado por
 * `FuenteClientes` en Clientes. */
export async function procedenciaCounts(): Promise<{ label: string; value: number }[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("ventas").select("procedencia");
  if (error) throw error;

  const conteo = new Map<string, number>();
  for (const v of data) {
    const c = v.procedencia ?? "Sin dato";
    conteo.set(c, (conteo.get(c) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

// ─────────────────────────── Ventas ───────────────────────────

type VentaItemRepuestoRow = {
  repuesto_id: string;
  cantidad: number;
  repuestos: { nombre: string } | null;
};

type VentaItemRow = {
  detalle: string;
  cantidad: number;
  precio_usd: number;
  costo_usd: number | null;
  equipo_id: string | null;
  categoria: VentaItem["categoria"] | null;
  venta_item_repuestos: VentaItemRepuestoRow[] | null;
};

type VentaRow = {
  id: string;
  numero: number;
  fecha: string;
  cliente_id: string | null;
  cliente: string;
  vendedor_id: string | null;
  profiles: { nombre: string } | null;
  procedencia: string | null;
  modalidad: ModalidadVenta;
  venta_items: VentaItemRow[];
  total_usd: number;
  pagos: Pago[];
  margen_pct: number | null;
  tipo: "venta" | "reparacion";
};

const VENTA_COLS =
  "id, numero, fecha, cliente_id, cliente, vendedor_id, profiles(nombre), procedencia, modalidad, venta_items(detalle, cantidad, precio_usd, costo_usd, equipo_id, categoria, venta_item_repuestos(repuesto_id, cantidad, repuestos(nombre))), total_usd, pagos, margen_pct, tipo";

function toVentaItem(row: VentaItemRow): VentaItem {
  return {
    detalle: row.detalle,
    cantidad: row.cantidad,
    precioUsd: row.precio_usd,
    costoUsd: row.costo_usd ?? undefined,
    equipoId: row.equipo_id ?? undefined,
    categoria: row.categoria ?? undefined,
    repuestos: (row.venta_item_repuestos ?? []).map((r) => ({
      repuestoId: r.repuesto_id,
      nombre: r.repuestos?.nombre ?? "—",
      cantidad: r.cantidad,
    })),
  };
}

function toVenta(
  row: VentaRow,
  tieneMovimientoCaja: boolean,
  tieneMovimientoCC: boolean,
): Venta {
  return {
    id: `V-${row.numero}`,
    fecha: fmtDayMonth(row.fecha),
    fechaISO: row.fecha.slice(0, 10),
    clienteId: row.cliente_id ?? "",
    cliente: row.cliente,
    vendedorId: row.vendedor_id ?? "",
    vendedor: row.profiles?.nombre ?? "—",
    procedencia: row.procedencia ?? undefined,
    modalidad: row.modalidad,
    items: (row.venta_items ?? []).map(toVentaItem),
    totalUsd: row.total_usd,
    pagos: row.pagos ?? [],
    margenPct: row.margen_pct ?? 0,
    tipo: row.tipo,
    tieneMovimientoCaja,
    tieneMovimientoCC,
  };
}

export async function listVentas(): Promise<Venta[]> {
  const supabase = createServerClient();
  const [{ data, error }, { data: movsCaja }, { data: movsCC }] = await Promise.all([
    supabase.from("ventas").select(VENTA_COLS).order("fecha", { ascending: false }),
    supabase.from("movimientos_caja").select("venta_id").not("venta_id", "is", null),
    supabase.from("movimientos_cc").select("venta_id").not("venta_id", "is", null),
  ]);
  if (error) throw error;

  const conMovCaja = new Set((movsCaja ?? []).map((m) => m.venta_id as string));
  const conMovCC = new Set((movsCC ?? []).map((m) => m.venta_id as string));

  return (data as unknown as VentaRow[]).map((row) =>
    toVenta(row, conMovCaja.has(row.id), conMovCC.has(row.id)),
  );
}

// ─────────── Listado paginado + filtros en server (plan 007) ───────────

// Argentina no tiene horario de verano: offset fijo UTC-3 todo el año.
const TZ_OFFSET = "-03:00";

function inicioART(iso: string): string {
  return `${iso}T00:00:00${TZ_OFFSET}`;
}

/** Límite superior exclusivo: `[desde 00:00 ART, hasta+1 00:00 ART)`. */
function finExclusivoART(iso: string): string {
  return `${sumarDias(iso, 1)}T00:00:00${TZ_OFFSET}`;
}

/** Ventas casadas por cliente/número (búsqueda rápida `q`). */
async function ventaIdsPorClienteNumero(q: string): Promise<string[]> {
  const supabase = createServerClient();
  const ids = new Set<string>();
  const { data } = await supabase
    .from("ventas")
    .select("id")
    .ilike("cliente", `%${q}%`)
    .limit(500);
  for (const v of data ?? []) ids.add(v.id as string);
  if (/^\d+$/.test(q.trim())) {
    const { data: porNumero } = await supabase
      .from("ventas")
      .select("id")
      .eq("numero", Number(q.trim()))
      .limit(1);
    for (const v of porNumero ?? []) ids.add(v.id as string);
  }
  return [...ids];
}

/** Ventas casadas por detalle de ítem o IMEI de equipo. El tope de 500 es a
 * propósito: una búsqueda muy amplia no debe generar un `in (...)` enorme. */
async function ventaIdsPorItems(q: string): Promise<string[]> {
  const supabase = createServerClient();
  const like = `%${q}%`;
  const [{ data: porDetalle }, { data: equipos }] = await Promise.all([
    supabase.from("venta_items").select("venta_id").ilike("detalle", like).limit(500),
    supabase.from("equipos").select("id").ilike("imei", like).limit(500),
  ]);
  const ids = new Set((porDetalle ?? []).map((r) => r.venta_id as string));
  const equipoIds = (equipos ?? []).map((e) => e.id as string);
  if (equipoIds.length > 0) {
    const { data: porEquipo } = await supabase
      .from("venta_items")
      .select("venta_id")
      .in("equipo_id", equipoIds)
      .limit(500);
    for (const r of porEquipo ?? []) ids.add(r.venta_id as string);
  }
  return [...ids];
}

/** Union cliente/número + ítems/IMEI, capada a 500 ventas. */
async function ventaIdsPorQuery(q: string): Promise<string[]> {
  const [porClienteNumero, porItems] = await Promise.all([
    ventaIdsPorClienteNumero(q),
    ventaIdsPorItems(q),
  ]);
  return [...new Set([...porClienteNumero, ...porItems])].slice(0, 500);
}

/** Ventas que tienen al menos un ítem del rubro dado, respetando el fallback
 * de `categoriaDe` para ventas viejas sin `categoria`. */
async function ventaIdsPorRubro(rubro: Rubro): Promise<string[]> {
  const supabase = createServerClient();
  let query = supabase.from("venta_items").select("venta_id");
  if (rubro === "equipo") {
    query = query.or("categoria.eq.equipo,and(categoria.is.null,equipo_id.not.is.null)");
  } else if (rubro === "libre") {
    query = query.or("categoria.eq.libre,and(categoria.is.null,equipo_id.is.null)");
  } else {
    query = query.eq("categoria", rubro);
  }
  const { data, error } = await query.limit(2000);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.venta_id as string))].slice(0, 500);
}

/** Ids de venta que resuelven los filtros de rubro y búsqueda. Es la parte
 * asíncrona del filtrado, separada a propósito de `aplicarFiltrosVentas`:
 * un builder de supabase-js es "thenable", así que una función `async` que
 * lo devuelve lo ejecuta solo al resolverse y entrega `{ data, error }` en
 * vez del builder (error real que tiró `query.order is not a function`).
 * `null` = ese filtro no está activo. */
type IdsFiltroVentas = { rubro: string[] | null; q: string[] | null };

async function resolverIdsVentas(f: FiltrosVentas): Promise<IdsFiltroVentas> {
  const [rubro, q] = await Promise.all([
    f.tipo ? ventaIdsPorRubro(f.tipo) : Promise.resolve(null),
    f.q ? ventaIdsPorQuery(f.q) : Promise.resolve(null),
  ]);
  return { rubro, q };
}

/** Aplica rango/vendedor/rubro/búsqueda al query de `ventas`. **Síncrona**
 * (devuelve el mismo builder, encadenable -- ver `IdsFiltroVentas`); usa
 * `is("id", null)` cuando el filtro no matchea nada. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltrosVentas(query: any, f: FiltrosVentas, rango: Rango, ids: IdsFiltroVentas): any {
  if (rango.desde) query = query.gte("fecha", inicioART(rango.desde));
  if (rango.hasta) query = query.lt("fecha", finExclusivoART(rango.hasta));
  if (f.vendedor) query = query.eq("vendedor_id", f.vendedor);
  if (ids.rubro) {
    if (ids.rubro.length === 0) return query.is("id", null);
    query = query.in("id", ids.rubro);
  }
  if (ids.q) {
    if (ids.q.length === 0) return query.is("id", null);
    query = query.in("id", ids.q);
  }
  return query;
}

/** Mapea filas con los flags de movimiento (consultas acotadas a esos ids). */
async function conFlags(rows: VentaRow[]): Promise<Venta[]> {
  if (rows.length === 0) return [];
  const supabase = createServerClient();
  const ids = rows.map((r) => r.id);
  const [{ data: movsCaja }, { data: movsCC }] = await Promise.all([
    supabase.from("movimientos_caja").select("venta_id").in("venta_id", ids),
    supabase.from("movimientos_cc").select("venta_id").in("venta_id", ids),
  ]);
  const conMovCaja = new Set((movsCaja ?? []).map((m) => m.venta_id as string));
  const conMovCC = new Set((movsCC ?? []).map((m) => m.venta_id as string));
  return rows.map((row) => toVenta(row, conMovCaja.has(row.id), conMovCC.has(row.id)));
}

/** Ventas completas por uuid de fila -- para resolver los ítems vendidos en
 * un solo fetch (los ítems traen el uuid de su venta, no el `"V-123"`). */
async function mapVentasPorUuid(ids: string[]): Promise<Map<string, Venta>> {
  const map = new Map<string, Venta>();
  if (ids.length === 0) return map;
  const supabase = createServerClient();
  const { data, error } = await supabase.from("ventas").select(VENTA_COLS).in("id", ids);
  if (error) throw error;
  const rows = data as unknown as VentaRow[];
  const ventas = await conFlags(rows);
  rows.forEach((row, i) => map.set(row.id, ventas[i]));
  return map;
}

/** Una página de ventas filtradas, ordenadas y contadas en el server. */
export async function listVentasPagina(
  f: FiltrosVentas,
): Promise<{ ventas: Venta[]; total: number }> {
  const supabase = createServerClient();
  const rango = rangoDe(f);
  const from = (f.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from("ventas").select(VENTA_COLS, { count: "exact" });
  query = aplicarFiltrosVentas(query, f, rango, await resolverIdsVentas(f));
  query = query
    .order(f.sort, { ascending: f.dir === "asc", nullsFirst: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  const ventas = await conFlags((data ?? []) as unknown as VentaRow[]);
  return { ventas, total: count ?? 0 };
}

/** Cantidad total de ventas que matchean los filtros (para el contador del
 * tab, sin traer filas). */
export async function contarVentas(f: FiltrosVentas): Promise<number> {
  const supabase = createServerClient();
  const rango = rangoDe(f);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from("ventas").select("id", { count: "exact", head: true });
  query = aplicarFiltrosVentas(query, f, rango, await resolverIdsVentas(f));
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/** KPIs del período filtrado **completo** (no solo la página): query liviana
 * sin `range`, calculada con `resumenDeVentas`. */
export async function resumenVentas(f: FiltrosVentas): Promise<ResumenVentas> {
  const supabase = createServerClient();
  const rango = rangoDe(f);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("ventas")
    .select("total_usd, venta_items(cantidad, precio_usd, costo_usd)");
  query = aplicarFiltrosVentas(query, f, rango, await resolverIdsVentas(f));

  const { data, error } = await query;
  if (error) throw error;
  return resumenDeVentas(
    (data ?? []).map((r: { total_usd: number; venta_items: { cantidad: number; precio_usd: number; costo_usd: number | null }[] | null }) => ({
      totalUsd: r.total_usd,
      items: (r.venta_items ?? []).map((i) => ({
        cantidad: i.cantidad,
        precioUsd: i.precio_usd,
        costoUsd: i.costo_usd ?? undefined,
      })),
    })),
  );
}

/** Gráficos del período filtrado completo (plan 009): facturación por día y
 * mix por rubro. Query liviana sin `range`, agregada con `graficosDeVentas`. */
export async function graficosVentas(f: FiltrosVentas): Promise<GraficosVentas> {
  const supabase = createServerClient();
  const rango = rangoDe(f);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("ventas")
    .select("fecha, total_usd, venta_items(cantidad, precio_usd, categoria, equipo_id)");
  query = aplicarFiltrosVentas(query, f, rango, await resolverIdsVentas(f));

  const { data, error } = await query;
  if (error) throw error;
  return graficosDeVentas(
    (data ?? []).map(
      (r: {
        fecha: string;
        total_usd: number;
        venta_items:
          | {
              cantidad: number;
              precio_usd: number;
              categoria: Rubro | null;
              equipo_id: string | null;
            }[]
          | null;
      }) => ({
        fechaISO: r.fecha,
        totalUsd: r.total_usd,
        rubros: (r.venta_items ?? []).map((i) => ({
          rubro: i.categoria ?? (i.equipo_id ? "equipo" : "libre"),
          monto: i.cantidad * i.precio_usd,
        })),
      }),
    ),
  );
}

/** Ventas casadas por detalle/IMEI/cliente/número, como ids de `venta_items`
 * (para el filtro `q` de la vista "Ítems vendidos", a nivel ítem). */async function itemIdsPorQuery(q: string): Promise<string[]> {
  const supabase = createServerClient();
  const like = `%${q}%`;
  const [detalle, ventaIds, equipoIds] = await Promise.all([
    supabase.from("venta_items").select("id").ilike("detalle", like).limit(500),
    ventaIdsPorClienteNumero(q),
    (async () => {
      const { data: equipos } = await supabase
        .from("equipos")
        .select("id")
        .ilike("imei", like)
        .limit(500);
      return (equipos ?? []).map((e) => e.id as string);
    })(),
  ]);
  const ids = new Set((detalle.data ?? []).map((r) => r.id as string));
  if (ventaIds.length > 0) {
    const { data } = await supabase
      .from("venta_items")
      .select("id")
      .in("venta_id", ventaIds)
      .limit(500);
    for (const r of data ?? []) ids.add(r.id as string);
  }
  if (equipoIds.length > 0) {
    const { data } = await supabase
      .from("venta_items")
      .select("id")
      .in("equipo_id", equipoIds)
      .limit(500);
    for (const r of data ?? []) ids.add(r.id as string);
  }
  return [...ids].slice(0, 500);
}

/** Aplica rango/vendedor/rubro/búsqueda al query de `venta_items` (los
 * filtros de venta van sobre la tabla embebida con `!inner`). **Síncrona**
 * por la misma razón que `aplicarFiltrosVentas`: `itemIds` (la búsqueda `q`)
 * se resuelve antes con `itemIdsPorQuery`; `null` = sin búsqueda. */
function aplicarFiltrosItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  f: FiltrosVentas,
  rango: Rango,
  itemIds: string[] | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (rango.desde) query = query.gte("ventas.fecha", inicioART(rango.desde));
  if (rango.hasta) query = query.lt("ventas.fecha", finExclusivoART(rango.hasta));
  if (f.vendedor) query = query.eq("ventas.vendedor_id", f.vendedor);
  if (f.tipo) {
    if (f.tipo === "equipo") {
      query = query.or("categoria.eq.equipo,and(categoria.is.null,equipo_id.not.is.null)");
    } else if (f.tipo === "libre") {
      query = query.or("categoria.eq.libre,and(categoria.is.null,equipo_id.is.null)");
    } else {
      query = query.eq("categoria", f.tipo);
    }
  }
  if (itemIds) {
    if (itemIds.length === 0) return query.is("id", null);
    query = query.in("id", itemIds);
  }
  return query;
}

export type ItemVendido = { venta: Venta; item: VentaItem; serial?: string };

type ItemRow = {
  detalle: string;
  cantidad: number;
  precio_usd: number;
  costo_usd: number | null;
  equipo_id: string | null;
  categoria: VentaItem["categoria"] | null;
  equipos: { imei: string } | null;
  ventas: { id: string };
};

const ITEM_COLS =
  "detalle, cantidad, precio_usd, costo_usd, equipo_id, categoria, equipos(imei), ventas!inner(id, fecha, numero, total_usd, margen_pct)";

/** Una página de ítems vendidos (vista "Ítems vendidos"), con las mismas
 * reglas de filtro/orden que la tabla de ventas. Cada fila trae su `Venta`
 * completa para poder abrir el mismo detalle. */
export async function listItemsVendidosPagina(
  f: FiltrosVentas,
): Promise<{ items: ItemVendido[]; total: number }> {
  const supabase = createServerClient();
  const rango = rangoDe(f);
  const from = (f.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from("venta_items").select(ITEM_COLS, { count: "exact" });
  query = aplicarFiltrosItems(query, f, rango, f.q ? await itemIdsPorQuery(f.q) : null);
  query = query
    .order(f.sort, { referencedTable: "ventas", ascending: f.dir === "asc", nullsFirst: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as ItemRow[];
  const porUuid = await mapVentasPorUuid([...new Set(rows.map((r) => r.ventas.id))]);

  const items: ItemVendido[] = [];
  for (const r of rows) {
    const venta = porUuid.get(r.ventas.id);
    if (!venta) continue;
    items.push({
      venta,
      item: {
        detalle: r.detalle,
        cantidad: r.cantidad,
        precioUsd: r.precio_usd,
        costoUsd: r.costo_usd ?? undefined,
        equipoId: r.equipo_id ?? undefined,
        categoria: r.categoria ?? undefined,
      },
      serial: r.equipos?.imei,
    });
  }
  return { items, total: count ?? 0 };
}

/** Cantidad total de ítems vendidos que matchean los filtros. */
export async function contarItemsVendidos(f: FiltrosVentas): Promise<number> {
  const supabase = createServerClient();
  const rango = rangoDe(f);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("venta_items")
    .select("id, ventas!inner(id)", { count: "exact", head: true });
  query = aplicarFiltrosItems(query, f, rango, f.q ? await itemIdsPorQuery(f.q) : null);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/** Una venta puntual por su id de app (`"V-1042"`) -- para el deep link
 * `?open=<id>` cuando la venta no está en la página filtrada actual. */
export async function getVenta(id: string): Promise<Venta | null> {
  const numero = Number(id.replace(/^V-/, ""));
  if (!Number.isFinite(numero)) return null;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("ventas")
    .select(VENTA_COLS)
    .eq("numero", numero)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [venta] = await conFlags([data as unknown as VentaRow]);
  return venta;
}

export type CreateVentaInput = {
  clienteId: string;
  cliente: string;
  vendedorId: string;
  vendedorNombre: string;
  procedencia?: string;
  modalidad: ModalidadVenta;
  items: VentaItem[];
  totalUsd: number;
  /** `canje` (solo en pagos con `medio === "canje"`) viaja acá para crear
   * la `Compra` vinculada -- nunca se persiste en `Venta.pagos`, ver
   * `createVenta`. */
  pagos: (Pago & { canje?: CanjeEquipo })[];
  margenPct: number;
  tipo: "venta" | "reparacion";
  /** Cotización blue vigente al momento de la venta -- para convertir a
   * pesos el monto de los pagos que van a una caja ARS (mismo criterio que
   * `Compra.cotizacion`). */
  dolarVenta: number;
};

/** Crea la venta, sus ítems (tabla propia `venta_items`, ver
 * "Backend y multi-tenancy" en CLAUDE.md) y:
 * - si algún ítem viene del stock de equipos (`equipoId`), marca esos
 *   equipos como vendidos;
 * - si algún ítem consumió repuestos (`VentaItem.repuestos`, solo tiene
 *   sentido en ítems de servicio), descuenta ese stock;
 * - por cada `Pago`, genera el movimiento correspondiente: un cargo en
 *   cuentas corrientes si el medio es "cuenta_corriente", o un movimiento
 *   de caja (usando la `cajaId` elegida en "Nueva venta", ya no hay que
 *   adivinar a qué caja fue la plata) para el resto.
 *
 * No es una transacción real (supabase-js no las soporta desde el
 * cliente) -- si un paso falla después del insert de la venta, se compensa
 * llamando a `deleteVenta` (abajo) que deshace cada efecto ya aplicado.
 * Si aparecen fallas reales que la compensación no alcance a cubrir, el
 * siguiente paso es subir todo esto a una función de Postgres transaccional
 * -- hoy no vale la complejidad para esta escala. */
export async function createVenta(data: CreateVentaInput): Promise<Venta> {
  const supabase = createServerClient();
  // `canje` nunca se persiste en `Venta.pagos` -- solo viaja para crear la
  // `Compra` vinculada más abajo, que es donde vive el detalle completo.
  // Los pagos a una caja ARS llevan además el snapshot de cotización
  // (`cotizacion`/`montoArs`): el mismo monto en pesos que va al
  // movimiento de caja, calculado acá para que la UI nunca tenga que
  // recalcularlo con el blue de hoy (ver `montoPagoLabel` en lib/ventas.ts).
  const pagosSinCanje: Pago[] = data.pagos.map(({ canje, ...p }) => {
    if (p.caja !== "ars" || !p.cajaId) return p;
    const montoArs = Math.round(montoConRecargo(p.montoUsd, p.recargoPct) * data.dolarVenta);
    return { ...p, cotizacion: data.dolarVenta, montoArs };
  });
  const { data: ventaRow, error } = await supabase
    .from("ventas")
    .insert({
      cliente_id: data.clienteId || null,
      cliente: data.cliente,
      vendedor_id: data.vendedorId || null,
      procedencia: data.procedencia ?? null,
      modalidad: data.modalidad,
      total_usd: data.totalUsd,
      pagos: pagosSinCanje,
      margen_pct: data.margenPct,
      tipo: data.tipo,
    })
    .select("id, numero")
    .single();
  if (error) throw error;

  // Todo lo que viene después del insert se compensa si algo falla a
  // mitad: `deleteVenta` deshace cada efecto (equipos, repuestos,
  // movimientos, compra de canje) y es no-op con lo que no llegó a
  // existir, así que sirve para una venta "incompleta".
  try {
    const { data: itemRows, error: itemsError } = await supabase
      .from("venta_items")
      .insert(
        data.items.map((item) => ({
          venta_id: ventaRow.id,
          detalle: item.detalle,
          cantidad: item.cantidad,
          precio_usd: item.precioUsd,
          costo_usd: item.costoUsd ?? null,
          equipo_id: item.equipoId ?? null,
          categoria: item.categoria ?? null,
        })),
      )
      .select("id");
    if (itemsError) throw itemsError;

    const equipoIds = data.items
      .map((i) => i.equipoId)
      .filter((x): x is string => !!x);
    if (equipoIds.length > 0) {
      const { error: updError } = await supabase
        .from("equipos")
        .update({ estado: "vendido" })
        .in("id", equipoIds);
      if (updError) throw updError;
    }

    // Repuestos usados por ítem (solo servicio) -- vincular + descontar
    // stock, mismo patrón leer-y-escribir que `ingresoRepuesto`
    // (lib/db/inventario.ts), restando en vez de sumar.
    for (let i = 0; i < data.items.length; i++) {
      const repuestosUsados = data.items[i].repuestos;
      if (!repuestosUsados?.length) continue;
      const ventaItemId = itemRows[i].id;
      for (const r of repuestosUsados) {
        const { error: linkError } = await supabase.from("venta_item_repuestos").insert({
          venta_item_id: ventaItemId,
          repuesto_id: r.repuestoId,
          cantidad: r.cantidad,
        });
        if (linkError) throw linkError;

        const { data: actual, error: readError } = await supabase
          .from("repuestos")
          .select("stock")
          .eq("id", r.repuestoId)
          .single();
        if (readError) throw readError;
        const { error: stockError } = await supabase
          .from("repuestos")
          .update({ stock: actual.stock - r.cantidad })
          .eq("id", r.repuestoId);
        if (stockError) throw stockError;
        await addMovimiento(
          "repuesto",
          r.repuestoId,
          `Usado en venta V-${ventaRow.numero}: -${r.cantidad} unidades`,
          "egreso",
        );
      }
    }

    // Pagos -- cada uno genera su movimiento de caja o de cuenta corriente;
    // un pago en canje además genera la `Compra` que documenta el equipo
    // recibido (checklist + PDF firmable, ver "Ventas" en CLAUDE.md).
    const concepto = `Venta V-${ventaRow.numero} · ${data.cliente}`;
    const compraIdPorIndice = new Map<number, string>();
    for (let i = 0; i < data.pagos.length; i++) {
      const pago = data.pagos[i];
      const montoReal = montoConRecargo(pago.montoUsd, pago.recargoPct);
      if (pago.medio === "cuenta_corriente") {
        if (!data.clienteId) continue;
        await createMovimientoCC({
          clienteId: data.clienteId,
          tipo: "cargo",
          concepto,
          montoUsd: montoReal,
          ventaId: ventaRow.id,
        });
      } else if (pago.cajaId) {
        // El monto en pesos del snapshot ya está calculado arriba -- se
        // reusa acá para que el movimiento de caja y `montoArs` siempre
        // coincidan exacto.
        const monto =
          pago.caja === "ars"
            ? (pagosSinCanje[i].montoArs ?? Math.round(montoReal * data.dolarVenta))
            : montoReal;
        const { error: movError } = await supabase.from("movimientos_caja").insert({
          caja_id: pago.cajaId,
          concepto,
          medio_pago: pago.medio,
          tipo: "ingreso",
          monto,
          cotizacion: data.dolarVenta,
          usuario_id: data.vendedorId || null,
          usuario_nombre: data.vendedorNombre,
          venta_id: ventaRow.id,
        });
        if (movError) throw movError;
      }

      if (pago.medio === "canje" && pago.canje) {
        const compra = await createCompra({
          origen: "canje",
          clienteId: data.clienteId,
          clienteNombre: data.cliente,
          ventaId: ventaRow.id,
          items: [{ detalle: pago.canje.equipo, cantidad: 1, costoUsd: pago.montoUsd }],
          totalUsd: pago.montoUsd,
          medioPago: "canje",
          estado: "recibida",
          marca: pago.canje.marca,
          imei: pago.canje.imei,
          checklist: pago.canje.checklist,
          aclaraciones: pago.canje.aclaraciones,
          usuarioNombre: data.vendedorNombre,
        });
        compraIdPorIndice.set(i, compra.id);
      }
    }

    if (compraIdPorIndice.size > 0) {
      for (const [i, compraId] of compraIdPorIndice) {
        pagosSinCanje[i] = { ...pagosSinCanje[i], compraId };
      }
      const { error: pagosUpdateError } = await supabase
        .from("ventas")
        .update({ pagos: pagosSinCanje })
        .eq("id", ventaRow.id);
      if (pagosUpdateError) throw pagosUpdateError;
    }
  } catch (err) {
    try {
      await deleteVenta(`V-${ventaRow.numero}`, {
        restituirEquipos: true,
        restituirRepuestos: true,
        eliminarMovimientosCaja: true,
        eliminarMovimientoCC: true,
        eliminarCompraCanje: true,
      });
    } catch (compensacionError) {
      // La compensación también falló -- queda vender el error original y
      // registrar ambos para poder limpiar a mano.
      console.error(
        `createVenta: falló la venta V-${ventaRow.numero} y su compensación`,
        { error: err, compensacionError },
      );
    }
    throw err;
  }

  const { data: row, error: selectError } = await supabase
    .from("ventas")
    .select(VENTA_COLS)
    .eq("id", ventaRow.id)
    .single();
  if (selectError) throw selectError;

  const tieneMovimientoCaja = data.pagos.some((p) => p.medio !== "cuenta_corriente" && p.cajaId);
  const tieneMovimientoCC = data.pagos.some((p) => p.medio === "cuenta_corriente");
  return toVenta(row as unknown as VentaRow, tieneMovimientoCaja, tieneMovimientoCC);
}

export type DeleteVentaOpts = {
  restituirEquipos: boolean;
  restituirRepuestos: boolean;
  eliminarMovimientosCaja: boolean;
  eliminarMovimientoCC: boolean;
  eliminarCompraCanje: boolean;
};

/** Borra la venta (sus `venta_items` caen solos por `on delete cascade`,
 * y con ellos `venta_item_repuestos`). Cinco reversiones independientes,
 * elegidas en el checkbox del modal de confirmación (`ventas-client.tsx`):
 * - `restituirEquipos`: los equipos vendidos vuelven a `disponible`.
 * - `restituirRepuestos`: los repuestos consumidos vuelven al stock.
 * - `eliminarMovimientosCaja` / `eliminarMovimientoCC`: borra también el
 *   movimiento generado por los pagos de esta venta -- si se deja en
 *   `false`, el movimiento sobrevive huérfano (`venta_id` vuelve a `null`
 *   solo por el `on delete set null` de la FK), como si fuera manual.
 * - `eliminarCompraCanje`: mismo criterio, para la `Compra` que haya
 *   generado un pago en canje (ver "Ventas" en CLAUDE.md).
 *
 * `id` es el `Venta.id` de la app (`"V-1042"`) -- no el uuid real de la
 * fila, que `toVenta` nunca expone hacia afuera. Se resuelve acá contra
 * `numero` antes de tocar nada. */
export async function deleteVenta(id: string, opts: DeleteVentaOpts): Promise<void> {
  const supabase = createServerClient();
  const numero = Number(id.replace(/^V-/, ""));

  const { data: ventaRow, error: ventaError } = await supabase
    .from("ventas")
    .select("id")
    .eq("numero", numero)
    .single();
  if (ventaError) throw ventaError;

  if (opts.restituirEquipos) {
    const { data: items, error: itemsError } = await supabase
      .from("venta_items")
      .select("equipo_id")
      .eq("venta_id", ventaRow.id)
      .not("equipo_id", "is", null);
    if (itemsError) throw itemsError;

    const equipoIds = (items ?? []).map((i) => i.equipo_id as string);
    if (equipoIds.length > 0) {
      const { error: updError } = await supabase
        .from("equipos")
        .update({ estado: "disponible" })
        .in("id", equipoIds);
      if (updError) throw updError;
    }
  }

  if (opts.restituirRepuestos) {
    const { data: ventaItems, error: itemsError } = await supabase
      .from("venta_items")
      .select("id")
      .eq("venta_id", ventaRow.id);
    if (itemsError) throw itemsError;
    const ventaItemIds = (ventaItems ?? []).map((i) => i.id as string);

    if (ventaItemIds.length > 0) {
      const { data: usados, error: usadosError } = await supabase
        .from("venta_item_repuestos")
        .select("repuesto_id, cantidad")
        .in("venta_item_id", ventaItemIds);
      if (usadosError) throw usadosError;

      const porRepuesto = new Map<string, number>();
      for (const u of usados ?? []) {
        porRepuesto.set(u.repuesto_id, (porRepuesto.get(u.repuesto_id) ?? 0) + u.cantidad);
      }
      for (const [repuestoId, cantidad] of porRepuesto) {
        const { data: actual, error: readError } = await supabase
          .from("repuestos")
          .select("stock")
          .eq("id", repuestoId)
          .single();
        if (readError) throw readError;
        const { error: stockError } = await supabase
          .from("repuestos")
          .update({ stock: actual.stock + cantidad })
          .eq("id", repuestoId);
        if (stockError) throw stockError;
        await addMovimiento(
          "repuesto",
          repuestoId,
          `Devuelto al borrar venta ${id}: +${cantidad} unidades`,
          "ingreso",
        );
      }
    }
  }

  if (opts.eliminarMovimientosCaja) {
    const { error: movError } = await supabase
      .from("movimientos_caja")
      .delete()
      .eq("venta_id", ventaRow.id);
    if (movError) throw movError;
  }

  if (opts.eliminarMovimientoCC) {
    const { error: ccError } = await supabase
      .from("movimientos_cc")
      .delete()
      .eq("venta_id", ventaRow.id);
    if (ccError) throw ccError;
  }

  if (opts.eliminarCompraCanje) {
    const { error: compraError } = await supabase
      .from("compras")
      .delete()
      .eq("venta_id", ventaRow.id);
    if (compraError) throw compraError;
  }

  const { error } = await supabase.from("ventas").delete().eq("id", ventaRow.id);
  if (error) throw error;
}

/** Vendedores posibles para el selector de "Nueva venta" -- admin y
 * vendedor pueden figurar como vendedor de una operación. */
export async function listVendedores(): Promise<{ id: string; nombre: string }[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre")
    .in("rol", ["admin", "vendedor"])
    .order("nombre");
  if (error) throw error;
  return data;
}
