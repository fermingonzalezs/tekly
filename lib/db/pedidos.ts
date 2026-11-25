import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { descripcionPedido } from "@/lib/pedidos";
import type { Pedido, PedidoEstado, PedidoItem } from "@/lib/types";

type PedidoRow = {
  id: string;
  cliente: string;
  cliente_id: string | null;
  descripcion: string;
  items: PedidoItem[] | null;
  sena_usd: number | string;
  fecha_entrega: string;
  estado: PedidoEstado;
  nota: string | null;
};

const COLS =
  "id, cliente, cliente_id, descripcion, items, sena_usd, fecha_entrega, estado, nota";

function toPedido(row: PedidoRow): Pedido {
  return {
    id: row.id,
    cliente: row.cliente,
    clienteId: row.cliente_id,
    descripcion: row.descripcion,
    items: row.items ?? [],
    senaUsd: Number(row.sena_usd),
    fechaEntrega: row.fecha_entrega,
    estado: row.estado,
    nota: row.nota ?? undefined,
  };
}

/** Pedidos con entrega en el rango (`YYYY-MM-DD`, ambos incluidos), en hora
 * argentina — las fechas las calcula quien llama. */
export async function listPedidosRango(desde: string, hasta: string): Promise<Pedido[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select(COLS)
    .gte("fecha_entrega", desde)
    .lte("fecha_entrega", hasta)
    .order("fecha_entrega")
    .order("created_at");
  if (error) throw error;
  return (data as PedidoRow[]).map(toPedido);
}

export type PedidoDatos = {
  cliente: string;
  clienteId: string | null;
  /** Ya validados y normalizados por la server action. */
  items: PedidoItem[];
  senaUsd: number;
  fechaEntrega: string;
  nota: string;
};

function columnas(d: PedidoDatos) {
  return {
    cliente: d.cliente,
    cliente_id: d.clienteId,
    // `descripcion` es `not null` y la siguen leyendo el chip, el confirm de
    // borrar y los pedidos viejos: se deriva de los ítems, no la escribe el
    // usuario.
    descripcion: descripcionPedido(d.items),
    items: d.items,
    sena_usd: d.senaUsd,
    fecha_entrega: d.fechaEntrega,
    nota: d.nota.trim() || null,
  };
}

export async function createPedido(d: PedidoDatos): Promise<Pedido> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("pedidos").insert(columnas(d)).select(COLS).single();
  if (error) throw error;
  return toPedido(data as PedidoRow);
}

export async function updatePedido(id: string, d: PedidoDatos): Promise<Pedido> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("pedidos")
    .update(columnas(d))
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return toPedido(data as PedidoRow);
}

export async function setPedidoEstado(id: string, estado: PedidoEstado): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("pedidos").update({ estado }).eq("id", id);
  if (error) throw error;
}

export async function deletePedido(id: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("pedidos").delete().eq("id", id);
  if (error) throw error;
}
