import "server-only";
import { errorDiferencia, precioMayoristaDe } from "@/lib/precios";
import { createServerClient } from "@/lib/auth/supabase";
import { fmtDayMonth } from "@/lib/format";
import { addMovimiento, deleteCelular, moverStockOtro } from "@/lib/db/inventario";
import { createMovimientoCC } from "@/lib/db/cuentas-corrientes";
import { createCompra } from "@/lib/db/compras";
import { conRecargoDeCaja, monedasDeCajasActivas } from "@/lib/db/cajas";
import { MEDIOS_CAJA } from "@/lib/status";
import { bateriaCanje, erroresCanje } from "@/lib/canje";
import {
  celularCanjeBorrable,
  cobradoNeto,
  errorVuelto,
  errorAjuste,
  errorItemsVenta,
  esVentaRegalo,
  preciosDeVenta,
  preciosConDiferencia,
  graficosDeVentas,
  margenVenta,
  montoConRecargo,
  pagoGeneraMovimientoCaja,
  resumenDeVentas,
  type GraficosVentas,
  type ResumenVentas,
  type Rubro,
} from "@/lib/ventas";
import { rangoDe, TIENDA_PRINCIPAL, type FiltrosVentas } from "@/lib/ventas-filtros";
import { sumarDias, type Rango } from "@/lib/date-presets";
import { PAGE_SIZE } from "@/lib/pagination";
import type { CanjeEquipo, CelularStatus, MedioPago, ModalidadVenta, Pago, Venta, VentaItem, VueltoVenta } from "@/lib/types";

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
  precio_lista_usd: number | null;
  regalo: boolean;
  costo_usd: number | null;
  celular_id: string | null;
  notebook_id: string | null;
  otro_id: string | null;
  otro_serial: string | null;
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
  vendedor_nombre: string | null;
  tienda_id: string | null;
  tiendas: { nombre: string } | null;
  profiles: { nombre: string } | null;
  procedencia: string | null;
  modalidad: ModalidadVenta;
  venta_items: VentaItemRow[];
  total_usd: number;
  ajuste_usd: number;
  diferencia_usd?: number | string | null;
  regalo: boolean;
  pagos: Pago[];
  vuelto?: VueltoVenta | null;
  margen_pct: number | null;
  tipo: "venta" | "reparacion";
};

const VENTA_COLS =
  "id, numero, fecha, cliente_id, cliente, vendedor_id, vendedor_nombre, profiles(nombre), tienda_id, tiendas(nombre), procedencia, modalidad, venta_items(detalle, cantidad, precio_usd, precio_lista_usd, regalo, costo_usd, celular_id, notebook_id, otro_id, otro_serial, categoria, venta_item_repuestos(repuesto_id, cantidad, repuestos(nombre))), total_usd, ajuste_usd, diferencia_usd, regalo, pagos, vuelto, margen_pct, tipo";

function toVentaItem(row: VentaItemRow): VentaItem {
  return {
    detalle: row.detalle,
    cantidad: row.cantidad,
    precioUsd: row.precio_usd,
    precioListaUsd: row.precio_lista_usd ?? undefined,
    regalo: row.regalo || undefined,
    costoUsd: row.costo_usd ?? undefined,
    celularId: row.celular_id ?? undefined,
    notebookId: row.notebook_id ?? undefined,
    otroId: row.otro_id ?? undefined,
    otroSerial: row.otro_serial ?? undefined,
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
    // Usuario de la org → su nombre actual; escrito a mano → el guardado.
    vendedor: row.profiles?.nombre ?? row.vendedor_nombre ?? "—",
    tiendaId: row.tienda_id ?? undefined,
    tienda: row.tiendas?.nombre ?? undefined,
    procedencia: row.procedencia ?? undefined,
    modalidad: row.modalidad,
    items: (row.venta_items ?? []).map(toVentaItem),
    totalUsd: row.total_usd,
    ajusteUsd: row.ajuste_usd !== 0 ? row.ajuste_usd : undefined,
    regalo: row.regalo || undefined,
    diferenciaUsd: Number(row.diferencia_usd ?? 0) > 0 ? Number(row.diferencia_usd) : undefined,
    pagos: row.pagos ?? [],
    vuelto: row.vuelto ?? undefined,
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
  const [{ data: porDetalle }, { data: celulares }, { data: notebooks }] =
    await Promise.all([
      supabase.from("venta_items").select("venta_id").ilike("detalle", like).limit(500),
      supabase.from("celulares").select("id").ilike("imei", like).limit(500),
      supabase.from("notebooks").select("id").ilike("numero_serie", like).limit(500),
    ]);
  const ids = new Set((porDetalle ?? []).map((r) => r.venta_id as string));
  const celularIds = (celulares ?? []).map((e) => e.id as string);
  if (celularIds.length > 0) {
    const { data: porCelular } = await supabase
      .from("venta_items")
      .select("venta_id")
      .in("celular_id", celularIds)
      .limit(500);
    for (const r of porCelular ?? []) ids.add(r.venta_id as string);
  }
  const notebookIds = (notebooks ?? []).map((n) => n.id as string);
  if (notebookIds.length > 0) {
    const { data: porNotebook } = await supabase
      .from("venta_items")
      .select("venta_id")
      .in("notebook_id", notebookIds)
      .limit(500);
    for (const r of porNotebook ?? []) ids.add(r.venta_id as string);
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
  if (rubro === "celular") {
    query = query.or("categoria.eq.celular,and(categoria.is.null,celular_id.not.is.null)");
  } else if (rubro === "libre") {
    query = query.or("categoria.eq.libre,and(categoria.is.null,celular_id.is.null)");
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
  if (f.tienda === TIENDA_PRINCIPAL) query = query.is("tienda_id", null);
  else if (f.tienda) query = query.eq("tienda_id", f.tienda);
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
    .select("fecha, total_usd, venta_items(cantidad, precio_usd, categoria, celular_id)");
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
              celular_id: string | null;
            }[]
          | null;
      }) => ({
        fechaISO: r.fecha,
        totalUsd: r.total_usd,
        rubros: (r.venta_items ?? []).map((i) => ({
          rubro: i.categoria ?? (i.celular_id ? "celular" : "libre"),
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
  const [detalle, ventaIds, celularIds] = await Promise.all([
    supabase.from("venta_items").select("id").ilike("detalle", like).limit(500),
    ventaIdsPorClienteNumero(q),
    (async () => {
      const { data: celulares } = await supabase
        .from("celulares")
        .select("id")
        .ilike("imei", like)
        .limit(500);
      return (celulares ?? []).map((e) => e.id as string);
    })(),
  ]);
  const { data: notebooks } = await supabase
    .from("notebooks")
    .select("id")
    .ilike("numero_serie", like)
    .limit(500);
  const notebookIds = (notebooks ?? []).map((n) => n.id as string);
  const ids = new Set((detalle.data ?? []).map((r) => r.id as string));
  if (ventaIds.length > 0) {
    const { data } = await supabase
      .from("venta_items")
      .select("id")
      .in("venta_id", ventaIds)
      .limit(500);
    for (const r of data ?? []) ids.add(r.id as string);
  }
  if (celularIds.length > 0) {
    const { data } = await supabase
      .from("venta_items")
      .select("id")
      .in("celular_id", celularIds)
      .limit(500);
    for (const r of data ?? []) ids.add(r.id as string);
  }
  if (notebookIds.length > 0) {
    const { data } = await supabase
      .from("venta_items")
      .select("id")
      .in("notebook_id", notebookIds)
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
  if (f.tienda === TIENDA_PRINCIPAL) query = query.is("ventas.tienda_id", null);
  else if (f.tienda) query = query.eq("ventas.tienda_id", f.tienda);
  if (f.tipo) {
    if (f.tipo === "celular") {
      query = query.or("categoria.eq.celular,and(categoria.is.null,celular_id.not.is.null)");
    } else if (f.tipo === "libre") {
      query = query.or("categoria.eq.libre,and(categoria.is.null,celular_id.is.null)");
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
  precio_lista_usd: number | null;
  regalo: boolean;
  costo_usd: number | null;
  celular_id: string | null;
  notebook_id: string | null;
  otro_id: string | null;
  otro_serial: string | null;
  categoria: VentaItem["categoria"] | null;
  celulares: { imei: string } | null;
  notebooks: { numero_serie: string | null } | null;
  ventas: { id: string };
};

const ITEM_COLS =
  "detalle, cantidad, precio_usd, precio_lista_usd, regalo, costo_usd, celular_id, notebook_id, otro_id, otro_serial, categoria, celulares(imei), notebooks(numero_serie), ventas!inner(id, fecha, numero, total_usd, ajuste_usd, regalo, margen_pct)";

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
        precioListaUsd: r.precio_lista_usd ?? undefined,
        regalo: r.regalo || undefined,
        costoUsd: r.costo_usd ?? undefined,
        celularId: r.celular_id ?? undefined,
        notebookId: r.notebook_id ?? undefined,
        otroId: r.otro_id ?? undefined,
        otroSerial: r.otro_serial ?? undefined,
        categoria: r.categoria ?? undefined,
      },
      serial: r.celulares?.imei ?? r.notebooks?.numero_serie ?? r.otro_serial ?? undefined,
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
  /** `null`/omitido = la tienda principal. */
  tiendaId?: string | null;
  procedencia?: string;
  modalidad: ModalidadVenta;
  /** Ítems con **precio de lista** + `regalo`; el descuento se prorratea acá. */
  items: VentaItem[];
  /** Diferencia total pedida, firmada (U$): >0 descuenta, <0 recarga. */
  ajusteUsd?: number;
  /** Faltante de cobro que el usuario aceptó en el cartel de confirmación
   * (U$). Se revalida contra el total recalculado: tiene que coincidir con
   * total − cobrado (`errorDiferencia`). */
  diferenciaAceptadaUsd?: number;
  /** La venta entera es un regalo (total 0, sin pagos). */
  regalo?: boolean;
  /** Ignorados: el server recalcula total y margen desde los ítems. */
  totalUsd?: number;
  /** `canje` (solo en pagos con `medio === "canje"`) viaja acá para crear
   * la `Compra` vinculada -- nunca se persiste en `Venta.pagos`, ver
   * `createVenta`. */
  pagos: (Pago & { canje?: CanjeEquipo })[];
  /** Vuelto entregado al cliente: solo `cajaId` + `montoUsd` cuentan, medio
   * y moneda se leen de la caja. Omitido = sin vuelto. */
  vuelto?: Pick<VueltoVenta, "cajaId" | "montoUsd" | "medio">;
  margenPct?: number;
  tipo: "venta" | "reparacion";
  /** Cotización blue vigente al momento de la venta -- para convertir a
   * pesos el monto de los pagos que van a una caja ARS (mismo criterio que
   * `Compra.cotizacion`). */
  dolarVenta: number;
};

/** Crea la venta, sus ítems (tabla propia `venta_items`, ver
 * "Backend y multi-tenancy" en CLAUDE.md) y:
 * - si algún ítem viene del stock de celulares (`celularId`), marca esos
 *   celulares como vendidos;
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
/** Arma el snapshot del vuelto desde la caja real (nunca desde el cliente):
 * tiene que ser una caja activa de la organización; si es en pesos, guarda
 * los pesos entregados a la cotización de la venta. */
async function vueltoDeCaja(
  v: Pick<VueltoVenta, "cajaId" | "montoUsd" | "medio">,
  dolarVenta: number,
): Promise<VueltoVenta> {
  // El medio es cómo se devolvió (lo elige el usuario); la caja puede ser
  // cualquiera de las activas. Canje no es una forma de dar vuelto.
  if (!MEDIOS_CAJA.includes(v.medio)) throw new Error("Elegí cómo diste el vuelto.");
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("cajas")
    .select("id, moneda, medio_pago, activa")
    .eq("id", v.cajaId)
    .maybeSingle();
  if (error) throw error;
  const caja = data as { id: string; moneda: "usd" | "ars"; medio_pago: MedioPago; activa: boolean } | null;
  if (!caja || !caja.activa) throw new Error("La caja del vuelto no existe o no está activa.");
  const montoUsd = Math.round(v.montoUsd * 100) / 100;
  if (caja.moneda !== "ars") {
    return { medio: v.medio, cajaId: caja.id, caja: "usd", montoUsd };
  }
  return {
    medio: v.medio,
    cajaId: caja.id,
    caja: "ars",
    montoUsd,
    cotizacion: dolarVenta,
    montoArs: Math.round(montoUsd * dolarVenta),
  };
}

export async function createVenta(data: CreateVentaInput): Promise<Venta> {
  const supabase = createServerClient();
  // El equipo recibido en canje se valida acá (nunca se confía en el
  // modal): modelo, IMEI, color, condición, batería y precio de compra.
  for (const p of data.pagos) {
    if (p.medio !== "canje") continue;
    const errores = erroresCanje(p.canje, p.montoUsd);
    if (errores.length > 0) throw new Error(errores.join(" "));
  }
  // Plan 026 (revisado): el total, los precios efectivos (diferencia
  // prorrateada o regalo) y el margen se recalculan acá; lo que mande el
  // cliente se ignora.
  // Solo stock o servicios del catálogo; regalos de «Otros» (errorItemsVenta).
  const errorItems = errorItemsVenta(data.items, data.ajusteUsd ?? 0);
  if (errorItems) throw new Error(errorItems);
  // «Regalo»: todos los ítems son regalo (o la marca vieja de venta entera).
  const esRegalo = !!data.regalo || esVentaRegalo(data.items);
  if (esRegalo && data.pagos.some((p) => p.montoUsd > 0)) {
    throw new Error("Un regalo no lleva pagos.");
  }
  // Sin pagos: ni movimientos de caja en 0 ni cargos en cuenta corriente.
  if (esRegalo) data = { ...data, pagos: [], vuelto: undefined };
  // La seña es un pago a una caja: nunca canje ni cuenta corriente.
  if (data.pagos.some((p) => p.sena && !pagoGeneraMovimientoCaja(p))) {
    throw new Error("La seña tiene que ir a una caja.");
  }
  const errVuelto = errorVuelto(data.vuelto, data.pagos);
  if (errVuelto) throw new Error(errVuelto);
  // Medio y moneda del vuelto salen de la caja (activa, de la org).
  const vuelto = data.vuelto ? await vueltoDeCaja(data.vuelto, data.dolarVenta) : undefined;
  let itemsConPrecio: VentaItem[];
  let totalUsd: number;
  let ajusteUsd = 0;
  let diferenciaUsd = 0;
  // Lo cobrado (sin recargo: el recargo infla lo que se mueve, no la
  // conciliación) contra el total recalculado. Un faltante solo pasa si se
  // aceptó en el cartel; lo que sobra nunca.
  // El vuelto se resta: Σ pagos − vuelto es lo que realmente quedó.
  const cobradoUsd = cobradoNeto(data.pagos, vuelto?.montoUsd ?? 0);
  if (esRegalo) {
    itemsConPrecio = data.items.map((item) => ({
      ...item,
      regalo: true,
      precioUsd: 0,
      precioListaUsd: undefined,
    }));
    totalUsd = 0;
  } else {
    // Regalos por ítem (precio 0, conservan el costo) + descuento ≥ 0
    // prorrateado en el resto. Nunca se confía en los precios del cliente
    // para los regalos ni en el total.
    const subtotalUsd = data.items
      .filter((i) => !i.regalo)
      .reduce((a, i) => a + Math.max(0, i.precioUsd) * i.cantidad, 0);
    const errorAjusteMsg = errorAjuste(subtotalUsd, data.ajusteUsd ?? 0);
    if (errorAjusteMsg) throw new Error(errorAjusteMsg);
    const base = preciosDeVenta(data.items, data.ajusteUsd ?? 0);
    const errorDif = errorDiferencia({
      totalUsd: base.totalUsd,
      cobradoUsd,
      aceptadaUsd: data.diferenciaAceptadaUsd ?? 0,
    });
    if (errorDif) throw new Error(errorDif);
    // La diferencia aceptada se reparte en los ítems como el descuento: el
    // total queda = lo cobrado y la ganancia/margen la restan en todos lados.
    const r = preciosConDiferencia(data.items, data.ajusteUsd ?? 0, cobradoUsd);
    itemsConPrecio = r.items;
    totalUsd = r.totalUsd;
    ajusteUsd = r.ajusteUsd;
    diferenciaUsd = r.diferenciaUsd;
  }
  const margenPct = Math.round((margenVenta(itemsConPrecio).margenPct ?? 0) * 10) / 10;
  // `canje` nunca se persiste en `Venta.pagos` -- solo viaja para crear la
  // `Compra` vinculada más abajo, que es donde vive el detalle completo.
  // Los pagos a una caja ARS llevan además el snapshot de cotización
  // (`cotizacion`/`montoArs`): el mismo monto en pesos que va al
  // movimiento de caja, calculado acá para que la UI nunca tenga que
  // recalcularlo con el blue de hoy (ver `montoPagoLabel` en lib/ventas.ts).
  let avisoCanje: string | undefined;
  // Recargo: sale de la caja elegida (o de la organización para cuenta
  // corriente), nunca del cliente. Queda como snapshot en cada pago.
  const monedas = await monedasDeCajasActivas(
    data.pagos.map((p) => p.cajaId).filter((id): id is string => !!id),
  );
  // La moneda de cada pago sale de su caja, nunca del cliente (la seña
  // puede ir a cualquier caja, no solo a las de su medio).
  const pagos = (await conRecargoDeCaja(data.pagos)).map((p) => {
    if (!p.cajaId) return p;
    const moneda = monedas.get(p.cajaId);
    if (!moneda) throw new Error("Una de las cajas elegidas no existe o no está activa.");
    return { ...p, caja: moneda };
  });
  const pagosSinCanje: Pago[] = pagos.map(({ canje, ...p }) => {
    // El canje no es una caja: no lleva `cajaId` ni snapshot en pesos
    // (siempre se carga en USD). Plan 020.
    if (p.medio === "canje") {
      return {
        ...p,
        caja: "usd",
        cajaId: undefined,
        cotizacion: undefined,
        montoArs: undefined,
      };
    }
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
      vendedor_nombre: data.vendedorId ? null : data.vendedorNombre.trim() || null,
      tienda_id: data.tiendaId ?? null,
      procedencia: data.procedencia ?? null,
      modalidad: data.modalidad,
      total_usd: totalUsd,
      ajuste_usd: ajusteUsd,
      diferencia_usd: diferenciaUsd,
      regalo: esRegalo,
      pagos: pagosSinCanje,
      vuelto: vuelto ?? null,
      margen_pct: margenPct,
      tipo: data.tipo,
    })
    .select("id, numero")
    .single();
  if (error) throw error;

  // Todo lo que viene después del insert se compensa si algo falla a
  // mitad: `deleteVenta` deshace cada efecto (celulares, repuestos,
  // movimientos, compra de canje) y es no-op con lo que no llegó a
  // existir, así que sirve para una venta "incompleta".
  try {
    const { data: itemRows, error: itemsError } = await supabase
      .from("venta_items")
      .insert(
        itemsConPrecio.map((item) => ({
          venta_id: ventaRow.id,
          detalle: item.detalle,
          cantidad: item.cantidad,
          precio_usd: item.precioUsd,
          precio_lista_usd: item.precioListaUsd ?? null,
          regalo: !!item.regalo,
          costo_usd: item.costoUsd ?? null,
          celular_id: item.celularId ?? null,
          notebook_id: item.notebookId ?? null,
          otro_id: item.otroId ?? null,
          otro_serial: item.otroSerial ?? null,
          categoria: item.categoria ?? null,
        })),
      )
      .select("id");
    if (itemsError) throw itemsError;

    const celularIds = data.items
      .map((i) => i.celularId)
      .filter((x): x is string => !!x);
    if (celularIds.length > 0) {
      const { error: updError } = await supabase
        .from("celulares")
        .update({ estado: "vendido" })
        .in("id", celularIds);
      if (updError) throw updError;
    }

    const notebookIds = data.items
      .map((i) => i.notebookId)
      .filter((x): x is string => !!x);
    if (notebookIds.length > 0) {
      const { error: updError } = await supabase
        .from("notebooks")
        .update({ estado: "vendido" })
        .in("id", notebookIds);
      if (updError) throw updError;
    }

    // «Otros» (accesorios, AirPods…): vender o regalar descuenta su stock.
    for (const item of data.items) {
      if (!item.otroId) continue;
      await moverStockOtro(
        item.otroId,
        { cantidad: item.cantidad, serial: item.otroSerial },
        "egreso",
        (item.regalo ? "Regalo en venta V-" : "Vendido en venta V-") +
          ventaRow.numero +
          (item.otroSerial ? " · " + item.otroSerial : ""),
      );
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
    if (vuelto) {
      // Egreso de la caja de donde salió el vuelto; `venta_id` hace que se
      // borre con «Borrar movimientos de caja» al eliminar la venta.
      const { error: vueltoError } = await supabase.from("movimientos_caja").insert({
        caja_id: vuelto.cajaId,
        concepto: `Vuelto · ${concepto}`,
        etiqueta: "vuelto",
        medio_pago: vuelto.medio,
        tipo: "egreso",
        monto: vuelto.caja === "ars" ? (vuelto.montoArs ?? 0) : vuelto.montoUsd,
        cotizacion: data.dolarVenta,
        usuario_id: data.vendedorId || null,
        usuario_nombre: data.vendedorNombre,
        venta_id: ventaRow.id,
      });
      if (vueltoError) throw vueltoError;
    }
    const compraIdPorIndice = new Map<number, string>();
    for (let i = 0; i < pagos.length; i++) {
      const pago = pagos[i];
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
      } else if (pagoGeneraMovimientoCaja(pago) && pago.cajaId) {
        // El monto en pesos del snapshot ya está calculado arriba -- se
        // reusa acá para que el movimiento de caja y `montoArs` siempre
        // coincidan exacto.
        const monto =
          pago.caja === "ars"
            ? (pagosSinCanje[i].montoArs ?? Math.round(montoReal * data.dolarVenta))
            : montoReal;
        const { error: movError } = await supabase.from("movimientos_caja").insert({
          caja_id: pago.cajaId,
          concepto: pago.sena ? `Seña · ${concepto}` : concepto,
          etiqueta: pago.sena ? "sena" : null,
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
        // El equipo recibido NO entra al stock: queda registrado en su
        // compra de canje y se pasa al inventario después, desde Compras
        // («Pasar al stock», `pasarCanjeAlStock` en lib/db/compras.ts).
        const c = pago.canje;
        const compra = await createCompra({
          origen: "canje",
          clienteId: data.clienteId,
          clienteNombre: data.cliente,
          ventaId: ventaRow.id,
          items: [{ detalle: c.modelo.trim(), cantidad: 1, costoUsd: pago.montoUsd }],
          totalUsd: pago.montoUsd,
          medioPago: "canje",
          estado: "recibida",
          imei: c.imei.trim(),
          checklist: c.testeo ? c.checklist : undefined,
          aclaraciones: c.detalles?.trim() || undefined,
          canje: {
            modelo: c.modelo.trim(),
            color: c.color.trim(),
            condicion: c.condicion,
            bateria: bateriaCanje(c),
            testeado: c.testeo,
          },
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
        restituirCelulares: true,
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

  const tieneMovimientoCaja =
    !!vuelto || pagos.some((p) => pagoGeneraMovimientoCaja(p) && !!p.cajaId);
  const tieneMovimientoCC = pagos.some((p) => p.medio === "cuenta_corriente");
  return {
    ...toVenta(row as unknown as VentaRow, tieneMovimientoCaja, tieneMovimientoCC),
    avisoCanje,
  };
}

export type DeleteVentaOpts = {
  restituirCelulares: boolean;
  restituirRepuestos: boolean;
  eliminarMovimientosCaja: boolean;
  eliminarMovimientoCC: boolean;
  eliminarCompraCanje: boolean;
};

/** Borra la venta (sus `venta_items` caen solos por `on delete cascade`,
 * y con ellos `venta_item_repuestos`). Cinco reversiones independientes,
 * elegidas en el checkbox del modal de confirmación (`ventas-client.tsx`):
 * - `restituirCelulares`: los celulares y notebooks vendidos vuelven a
 *   `disponible`.
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
export async function deleteVenta(
  id: string,
  opts: DeleteVentaOpts,
): Promise<string | null> {
  const supabase = createServerClient();
  const numero = Number(id.replace(/^V-/, ""));

  const { data: ventaRow, error: ventaError } = await supabase
    .from("ventas")
    .select("id, pagos")
    .eq("numero", numero)
    .single();
  if (ventaError) throw ventaError;

  if (opts.restituirCelulares) {
    const { data: items, error: itemsError } = await supabase
      .from("venta_items")
      .select("celular_id")
      .eq("venta_id", ventaRow.id)
      .not("celular_id", "is", null);
    if (itemsError) throw itemsError;

    const celularIds = (items ?? []).map((i) => i.celular_id as string);
    if (celularIds.length > 0) {
      const { error: updError } = await supabase
        .from("celulares")
        .update({ estado: "disponible" })
        .in("id", celularIds);
      if (updError) throw updError;
    }

    const { data: nbItems, error: nbError } = await supabase
      .from("venta_items")
      .select("notebook_id")
      .eq("venta_id", ventaRow.id)
      .not("notebook_id", "is", null);
    if (nbError) throw nbError;
    const notebookIds = (nbItems ?? []).map((i) => i.notebook_id as string);
    if (notebookIds.length > 0) {
      const { error: updError } = await supabase
        .from("notebooks")
        .update({ estado: "disponible" })
        .in("id", notebookIds);
      if (updError) throw updError;
    }

    const { data: otrosItems, error: otrosError } = await supabase
      .from("venta_items")
      .select("otro_id, otro_serial, cantidad")
      .eq("venta_id", ventaRow.id)
      .not("otro_id", "is", null);
    if (otrosError) throw otrosError;
    for (const it of otrosItems ?? []) {
      try {
        await moverStockOtro(
          it.otro_id as string,
          { cantidad: Number(it.cantidad), serial: it.otro_serial ?? undefined },
          "ingreso",
          "Devuelto al borrar la venta " + id,
        );
      } catch {
        // La unidad ya no existe o se editó a mano: no frena el borrado.
      }
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

  let aviso: string | null = null;
  if (opts.eliminarCompraCanje) {
    // Celulares que salieron de un canje de esta venta: los que ya se pasaron
    // al stock desde Compras (`compra_id` = la compra de canje) y, en canjes
    // viejos (plan 020), el que se dio de alta junto con la venta
    // (`Pago.celularId`). Solo se dan de baja si todavía no se movieron.
    const { data: comprasCanje, error: comprasError } = await supabase
      .from("compras")
      .select("id")
      .eq("venta_id", ventaRow.id);
    if (comprasError) throw comprasError;
    const compraIds = (comprasCanje ?? []).map((c) => c.id as string);
    const celularIds = new Set(
      ((ventaRow.pagos ?? []) as Pago[])
        .filter((p) => p.medio === "canje" && p.celularId)
        .map((p) => p.celularId as string),
    );
    if (compraIds.length > 0) {
      const { data: ingresados, error: ingError } = await supabase
        .from("celulares")
        .select("id")
        .in("compra_id", compraIds);
      if (ingError) throw ingError;
      for (const c of ingresados ?? []) celularIds.add(c.id as string);
    }
    for (const celularId of celularIds) {
      const { data: celular, error: celError } = await supabase
        .from("celulares")
        .select("id, estado")
        .eq("id", celularId)
        .maybeSingle();
      if (celError) throw celError;
      if (!celular) continue;
      if (celularCanjeBorrable(celular.estado as CelularStatus)) {
        await deleteCelular(celularId);
      } else {
        aviso =
          "El celular recibido en canje ya se movió: se conservó en inventario.";
      }
    }

    const { error: compraError } = await supabase
      .from("compras")
      .delete()
      .eq("venta_id", ventaRow.id);
    if (compraError) throw compraError;
  }

  const { error } = await supabase.from("ventas").delete().eq("id", ventaRow.id);
  if (error) throw error;
  return aviso;
}

/** Vendedores posibles para el selector de "Nueva venta" -- admin y
 * vendedor pueden figurar como vendedor de una operación. */
/** Usuarios activos de la organización (cualquier rol): las opciones del
 * campo Vendedor de Nueva venta. */
export async function listUsuariosVenta(): Promise<{ id: string; nombre: string }[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  if (error) throw error;
  return data;
}

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

/** Precios del stock para los ítems de una venta nueva (`createVentaAction`
 * los usa para que solo un admin pueda cambiar el precio de venta). Claves
 * `c:<celularId>`, `n:<notebookId>`, `o:<otroId>`; el mayorista ya resuelto
 * (el de la unidad o el de su variante, `precioMayoristaDe`). */
export async function preciosDelStock(
  items: Pick<VentaItem, "celularId" | "notebookId" | "otroId">[],
): Promise<Map<string, { precioUsd: number; mayoristaUsd: number | null }>> {
  const supabase = createServerClient();
  const ids = (k: "celularId" | "notebookId" | "otroId") =>
    [...new Set(items.map((i) => i[k]).filter((x): x is string => !!x))];
  const celularIds = ids("celularId");
  const notebookIds = ids("notebookId");
  const otroIds = ids("otroId");
  type UnidadRow = {
    id: string;
    precio_usd: number;
    precio_mayorista_usd: number | string | null;
    variantes: { precio_mayorista_usd: number | string | null } | null;
  };
  const num = (v: number | string | null | undefined) =>
    v === null || v === undefined ? null : Number(v);
  const [cel, nb, otros] = await Promise.all([
    celularIds.length
      ? supabase
          .from("celulares")
          .select("id, precio_usd, precio_mayorista_usd, variantes(precio_mayorista_usd)")
          .in("id", celularIds)
      : Promise.resolve({ data: [], error: null }),
    notebookIds.length
      ? supabase
          .from("notebooks")
          .select("id, precio_usd, precio_mayorista_usd, variantes(precio_mayorista_usd)")
          .in("id", notebookIds)
      : Promise.resolve({ data: [], error: null }),
    otroIds.length
      ? supabase.from("otros_items").select("id, precio_usd").in("id", otroIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [cel, nb, otros]) if (r.error) throw r.error;
  const mapa = new Map<string, { precioUsd: number; mayoristaUsd: number | null }>();
  const unidad = (prefijo: string, rows: UnidadRow[]) => {
    for (const r of rows) {
      mapa.set(prefijo + r.id, {
        precioUsd: Number(r.precio_usd),
        mayoristaUsd: precioMayoristaDe(
          { precioMayoristaUsd: num(r.precio_mayorista_usd) },
          { precioMayoristaUsd: num(r.variantes?.precio_mayorista_usd) },
        ),
      });
    }
  };
  unidad("c:", (cel.data ?? []) as unknown as UnidadRow[]);
  unidad("n:", (nb.data ?? []) as unknown as UnidadRow[]);
  for (const r of (otros.data ?? []) as { id: string; precio_usd: number }[]) {
    mapa.set("o:" + r.id, { precioUsd: Number(r.precio_usd), mayoristaUsd: null });
  }
  return mapa;
}
