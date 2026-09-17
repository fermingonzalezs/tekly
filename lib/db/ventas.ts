import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { fmtDayMonth } from "@/lib/format";
import type { Pago, Venta, VentaItem } from "@/lib/types";

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

type VentaItemRow = {
  detalle: string;
  cantidad: number;
  precio_usd: number;
  costo_usd: number | null;
  equipo_id: string | null;
  categoria: VentaItem["categoria"] | null;
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
  venta_items: VentaItemRow[];
  total_usd: number;
  pagos: Pago[];
  margen_pct: number | null;
  tipo: "venta" | "reparacion";
};

const VENTA_COLS =
  "id, numero, fecha, cliente_id, cliente, vendedor_id, profiles(nombre), procedencia, venta_items(detalle, cantidad, precio_usd, costo_usd, equipo_id, categoria), total_usd, pagos, margen_pct, tipo";

function toVentaItem(row: VentaItemRow): VentaItem {
  return {
    detalle: row.detalle,
    cantidad: row.cantidad,
    precioUsd: row.precio_usd,
    costoUsd: row.costo_usd ?? undefined,
    equipoId: row.equipo_id ?? undefined,
    categoria: row.categoria ?? undefined,
  };
}

function toVenta(row: VentaRow): Venta {
  return {
    id: `V-${row.numero}`,
    fecha: fmtDayMonth(row.fecha),
    fechaISO: row.fecha.slice(0, 10),
    clienteId: row.cliente_id ?? "",
    cliente: row.cliente,
    vendedorId: row.vendedor_id ?? "",
    vendedor: row.profiles?.nombre ?? "—",
    procedencia: row.procedencia ?? undefined,
    items: (row.venta_items ?? []).map(toVentaItem),
    totalUsd: row.total_usd,
    pagos: row.pagos ?? [],
    margenPct: row.margen_pct ?? 0,
    tipo: row.tipo,
  };
}

export async function listVentas(): Promise<Venta[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("ventas")
    .select(VENTA_COLS)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return (data as unknown as VentaRow[]).map(toVenta);
}

export type CreateVentaInput = {
  clienteId: string;
  cliente: string;
  vendedorId: string;
  procedencia?: string;
  items: VentaItem[];
  totalUsd: number;
  pagos: Pago[];
  margenPct: number;
  tipo: "venta" | "reparacion";
};

/** Crea la venta, sus ítems (tabla propia `venta_items`, ver
 * "Backend y multi-tenancy" en CLAUDE.md) y, si alguno viene del stock de
 * equipos (`equipoId`), marca esos equipos como vendidos. No es una
 * transacción real (supabase-js no las soporta desde el cliente) -- si un
 * paso fallara quedaría la venta creada sin sus ítems o sin el equipo
 * marcado; aceptable para esta escala, se podría subir a una función de
 * Postgres más adelante si hace falta atomicidad estricta. */
export async function createVenta(data: CreateVentaInput): Promise<Venta> {
  const supabase = createServerClient();
  const { data: ventaRow, error } = await supabase
    .from("ventas")
    .insert({
      cliente_id: data.clienteId || null,
      cliente: data.cliente,
      vendedor_id: data.vendedorId || null,
      procedencia: data.procedencia ?? null,
      total_usd: data.totalUsd,
      pagos: data.pagos,
      margen_pct: data.margenPct,
      tipo: data.tipo,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: itemsError } = await supabase.from("venta_items").insert(
    data.items.map((item) => ({
      venta_id: ventaRow.id,
      detalle: item.detalle,
      cantidad: item.cantidad,
      precio_usd: item.precioUsd,
      costo_usd: item.costoUsd ?? null,
      equipo_id: item.equipoId ?? null,
      categoria: item.categoria ?? null,
    })),
  );
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

  const { data: row, error: selectError } = await supabase
    .from("ventas")
    .select(VENTA_COLS)
    .eq("id", ventaRow.id)
    .single();
  if (selectError) throw selectError;

  return toVenta(row as unknown as VentaRow);
}

/** Borra la venta (sus `venta_items` caen solos por `on delete cascade`) y
 * devuelve al stock los equipos que había vendido -- vuelven a
 * `disponible`, como si la venta nunca hubiera pasado. No revierte nada de
 * repuestos/otros: vender esos ítems nunca descuenta su stock (eso se
 * maneja aparte, con Recuento/Ingreso en Inventario).
 *
 * `id` es el `Venta.id` de la app (`"V-1042"`) -- no el uuid real de la
 * fila, que `toVenta` nunca expone hacia afuera. Se resuelve acá contra
 * `numero` antes de tocar nada. */
export async function deleteVenta(id: string): Promise<void> {
  const supabase = createServerClient();
  const numero = Number(id.replace(/^V-/, ""));

  const { data: ventaRow, error: ventaError } = await supabase
    .from("ventas")
    .select("id")
    .eq("numero", numero)
    .single();
  if (ventaError) throw ventaError;

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
