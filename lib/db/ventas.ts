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

type VentaRow = {
  id: string;
  numero: number;
  fecha: string;
  cliente_id: string | null;
  cliente: string;
  vendedor_id: string | null;
  profiles: { nombre: string } | null;
  procedencia: string | null;
  items: VentaItem[];
  total_usd: number;
  pagos: Pago[];
  margen_pct: number | null;
  tipo: "venta" | "reparacion";
};

const VENTA_COLS =
  "id, numero, fecha, cliente_id, cliente, vendedor_id, profiles(nombre), procedencia, items, total_usd, pagos, margen_pct, tipo";

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
    items: row.items ?? [],
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

/** Crea la venta y, si algún ítem viene del stock de equipos (`equipoId`),
 * marca esos equipos como vendidos. No es una transacción real (supabase-js
 * no las soporta desde el cliente) -- si el segundo paso fallara quedaría
 * la venta creada sin el equipo marcado; aceptable para esta escala, se
 * podría subir a una función de Postgres más adelante si hace falta
 * atomicidad estricta. */
export async function createVenta(data: CreateVentaInput): Promise<Venta> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("ventas")
    .insert({
      cliente_id: data.clienteId || null,
      cliente: data.cliente,
      vendedor_id: data.vendedorId || null,
      procedencia: data.procedencia ?? null,
      items: data.items,
      total_usd: data.totalUsd,
      pagos: data.pagos,
      margen_pct: data.margenPct,
      tipo: data.tipo,
    })
    .select(VENTA_COLS)
    .single();
  if (error) throw error;

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

  return toVenta(row as unknown as VentaRow);
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
