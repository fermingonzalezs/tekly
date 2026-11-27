import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { requireUser } from "@/lib/auth";
import { cambioSena, descripcionPedido, senaEnCaja, totalPedido, type SenaCaja } from "@/lib/pedidos";
import type { MedioPago, Pedido, PedidoEstado, PedidoItem, PedidoSena } from "@/lib/types";

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
  movimientos_caja: {
    id: string;
    caja_id: string;
    monto: number | string;
    cotizacion: number | string | null;
    conciliacion_id: string | null;
  }[];
};

const COLS =
  "id, cliente, cliente_id, descripcion, items, sena_usd, fecha_entrega, estado, nota, movimientos_caja(id, caja_id, monto, cotizacion, conciliacion_id)";

function senaDe(row: PedidoRow): PedidoSena | undefined {
  const m = row.movimientos_caja?.[0];
  if (!m) return undefined;
  return {
    movimientoId: m.id,
    cajaId: m.caja_id,
    monto: Number(m.monto),
    cotizacion: m.cotizacion != null ? Number(m.cotizacion) : null,
    conciliado: m.conciliacion_id != null,
  };
}

function toPedido(row: PedidoRow): Pedido {
  return {
    id: row.id,
    cliente: row.cliente,
    clienteId: row.cliente_id,
    descripcion: row.descripcion,
    items: row.items ?? [],
    senaUsd: Number(row.sena_usd),
    sena: senaDe(row),
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
  return (data as unknown as PedidoRow[]).map(toPedido);
}

/** Pedidos sin entregar ni cancelar, de cualquier fecha (KPIs de la Agenda). */
export async function listPedidosAbiertos(): Promise<Pedido[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select(COLS)
    .in("estado", ["pedido", "llego"] satisfies PedidoEstado[])
    .order("fecha_entrega");
  if (error) throw error;
  return (data as unknown as PedidoRow[]).map(toPedido);
}

export type PedidoDatos = {
  cliente: string;
  clienteId: string | null;
  /** Ya validados y normalizados por la server action. */
  items: PedidoItem[];
  /** `null` = sin seña. El USD se calcula acá, desde la caja (nunca del
   * cliente). */
  sena: SenaCaja | null;
  fechaEntrega: string;
  nota: string;
};

type SenaResuelta = {
  cajaId: string;
  medio: MedioPago;
  monto: number;
  cotizacion: number;
  senaUsd: number;
};

/** Valida la caja (de la org, activa) y pasa el monto a USD. */
async function resolverSena(
  sena: SenaCaja | null,
  items: PedidoItem[],
): Promise<SenaResuelta | null> {
  if (!sena) return null;
  const supabase = createServerClient();
  const { data: caja, error } = await supabase
    .from("cajas")
    .select("moneda, medio_pago, activa")
    .eq("id", sena.cajaId)
    .maybeSingle();
  if (error) throw error;
  if (!caja || !caja.activa) throw new Error("Elegí una caja activa para la seña.");
  const r = senaEnCaja(caja.moneda, sena.monto, sena.cotizacion);
  if (!r) throw new Error("El monto de la seña no es válido.");
  if (r.senaUsd > totalPedido(items) + 0.01) throw new Error("La seña no puede superar el total.");
  return {
    cajaId: sena.cajaId,
    medio: caja.medio_pago,
    monto: r.monto,
    cotizacion: sena.cotizacion,
    senaUsd: r.senaUsd,
  };
}

async function crearMovimientoSena(pedidoId: string, cliente: string, s: SenaResuelta) {
  const user = await requireUser();
  const supabase = createServerClient();
  const { error } = await supabase.from("movimientos_caja").insert({
    caja_id: s.cajaId,
    concepto: `Seña pedido · ${cliente}`,
    etiqueta: "sena",
    medio_pago: s.medio,
    tipo: "ingreso",
    monto: s.monto,
    cotizacion: s.cotizacion > 0 ? s.cotizacion : null,
    usuario_id: user.id,
    usuario_nombre: user.nombre,
    pedido_id: pedidoId,
  });
  if (error) throw error;
}

async function borrarMovimiento(id: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("movimientos_caja")
    .delete()
    .eq("id", id)
    .is("conciliacion_id", null);
  if (error) throw error;
}

async function getPedido(id: string): Promise<Pedido> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("pedidos").select(COLS).eq("id", id).single();
  if (error) throw error;
  return toPedido(data as unknown as PedidoRow);
}

function columnas(d: PedidoDatos, senaUsd: number) {
  return {
    cliente: d.cliente,
    cliente_id: d.clienteId,
    // `descripcion` es `not null` y la siguen leyendo el chip, el confirm de
    // borrar y los pedidos viejos: se deriva de los ítems, no la escribe el
    // usuario.
    descripcion: descripcionPedido(d.items),
    items: d.items,
    sena_usd: senaUsd,
    fecha_entrega: d.fechaEntrega,
    nota: d.nota.trim() || null,
  };
}

/** Crea el pedido y, si hay seña, su ingreso en la caja. Si el movimiento
 * falla, se borra el pedido (no es una transacción real, mismo criterio que
 * `createVenta`). */
export async function createPedido(d: PedidoDatos): Promise<Pedido> {
  const sena = await resolverSena(d.sena, d.items);
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("pedidos")
    .insert(columnas(d, sena?.senaUsd ?? 0))
    .select("id")
    .single();
  if (error) throw error;
  if (sena) {
    try {
      await crearMovimientoSena(data.id, d.cliente, sena);
    } catch (e) {
      await supabase.from("pedidos").delete().eq("id", data.id);
      throw e;
    }
  }
  return getPedido(data.id);
}

/** Edita el pedido. La seña solo se toca si cambió la caja o el monto: el
 * movimiento anterior se borra y se crea uno nuevo; si ya estaba conciliado,
 * no se puede cambiar. */
export async function updatePedido(id: string, d: PedidoDatos): Promise<Pedido> {
  const anterior = await getPedido(id);
  const sena = await resolverSena(d.sena, d.items);
  const accion = cambioSena(
    anterior.sena ?? null,
    sena ? { cajaId: sena.cajaId, monto: sena.monto } : null,
  );
  if (accion === "bloqueado") {
    throw new Error("La seña ya está conciliada en Cajas: no se puede cambiar.");
  }
  // Sin cambios en la seña, se conserva el USD guardado (no se recalcula con
  // el dólar de hoy).
  const senaUsd = accion === "igual" ? anterior.senaUsd : (sena?.senaUsd ?? 0);

  const supabase = createServerClient();
  const { error } = await supabase.from("pedidos").update(columnas(d, senaUsd)).eq("id", id);
  if (error) throw error;
  if (accion === "reemplazar") {
    if (anterior.sena) await borrarMovimiento(anterior.sena.movimientoId);
    if (sena) await crearMovimientoSena(id, d.cliente, sena);
  }
  return getPedido(id);
}

export async function setPedidoEstado(id: string, estado: PedidoEstado): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("pedidos").update({ estado }).eq("id", id);
  if (error) throw error;
}

/** Borra el pedido y su seña sin conciliar. Una seña ya conciliada queda en
 * la caja (`pedido_id` pasa a null): su conciliación ya la contó. */
export async function deletePedido(id: string): Promise<void> {
  const supabase = createServerClient();
  const { error: movError } = await supabase
    .from("movimientos_caja")
    .delete()
    .eq("pedido_id", id)
    .is("conciliacion_id", null);
  if (movError) throw movError;
  const { error } = await supabase.from("pedidos").delete().eq("id", id);
  if (error) throw error;
}
