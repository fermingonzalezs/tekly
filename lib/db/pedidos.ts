import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import type { Pedido, PedidoEstado } from "@/lib/types";

type PedidoRow = {
  id: string;
  cliente: string;
  cliente_id: string | null;
  descripcion: string;
  fecha_entrega: string;
  estado: PedidoEstado;
  nota: string | null;
};

const COLS = "id, cliente, cliente_id, descripcion, fecha_entrega, estado, nota";

function toPedido(row: PedidoRow): Pedido {
  return {
    id: row.id,
    cliente: row.cliente,
    clienteId: row.cliente_id,
    descripcion: row.descripcion,
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
  descripcion: string;
  fechaEntrega: string;
  nota: string;
};

function columnas(d: PedidoDatos) {
  return {
    cliente: d.cliente,
    cliente_id: d.clienteId,
    descripcion: d.descripcion.trim(),
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
