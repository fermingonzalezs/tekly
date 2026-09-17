import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { resolveProveedorId } from "@/lib/db/inventario";
import type { Compra, CompraEstado, CompraItem, MedioPago } from "@/lib/types";

type CompraRow = {
  id: string;
  numero: number;
  fecha: string;
  proveedor_nombre: string;
  items: CompraItem[];
  total_usd: number;
  medio_pago: MedioPago;
  estado: CompraEstado;
  monto_ars: number | null;
  cotizacion: number | null;
};

const COMPRA_COLS =
  "id, numero, fecha, proveedor_nombre, items, total_usd, medio_pago, estado, monto_ars, cotizacion";

function toCompra(row: CompraRow): Compra {
  return {
    id: `C-${row.numero}`,
    fecha: new Date(row.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
    fechaISO: row.fecha.slice(0, 10),
    proveedor: row.proveedor_nombre,
    items: row.items ?? [],
    totalUsd: row.total_usd,
    medioPago: row.medio_pago,
    estado: row.estado,
    montoArs: row.monto_ars ?? undefined,
    cotizacion: row.cotizacion ?? undefined,
  };
}

export async function listCompras(): Promise<Compra[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("compras")
    .select(COMPRA_COLS)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return (data as unknown as CompraRow[]).map(toCompra);
}

export async function createCompra(data: {
  proveedor: string;
  items: CompraItem[];
  totalUsd: number;
  medioPago: MedioPago;
  montoArs?: number;
  cotizacion?: number;
}): Promise<Compra> {
  const proveedorId = await resolveProveedorId(data.proveedor);
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("compras")
    .insert({
      proveedor_id: proveedorId,
      proveedor_nombre: data.proveedor,
      items: data.items,
      total_usd: data.totalUsd,
      medio_pago: data.medioPago,
      estado: "pendiente" satisfies CompraEstado,
      monto_ars: data.montoArs ?? null,
      cotizacion: data.cotizacion ?? null,
    })
    .select(COMPRA_COLS)
    .single();
  if (error) throw error;
  return toCompra(row as unknown as CompraRow);
}

export async function deleteCompra(id: string): Promise<void> {
  const supabase = createServerClient();
  const numero = Number(id.replace(/^C-/, ""));
  const { error } = await supabase.from("compras").delete().eq("numero", numero);
  if (error) throw error;
}

export async function marcarRecibida(id: string): Promise<Compra> {
  const supabase = createServerClient();
  const numero = Number(id.replace(/^C-/, ""));
  const { data: row, error } = await supabase
    .from("compras")
    .update({ estado: "recibida" satisfies CompraEstado })
    .eq("numero", numero)
    .select(COMPRA_COLS)
    .single();
  if (error) throw error;
  return toCompra(row as unknown as CompraRow);
}
