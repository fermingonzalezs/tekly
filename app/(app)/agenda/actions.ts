"use server";

import { revalidatePath } from "next/cache";
import { requireEscritura, requireRoleEscritura } from "@/lib/auth";
import { resolveCliente } from "@/lib/db/clientes";
import { createTurno, updateTurno, setTurnoEstado, deleteTurno } from "@/lib/db/turnos";
import { createPedido, deletePedido, setPedidoEstado, updatePedido } from "@/lib/db/pedidos";
import { errorPedido, limpiarItems, normalizarItems, type SenaCaja } from "@/lib/pedidos";
import type {
  ClienteSeleccion,
  Pago,
  PedidoEstado,
  PedidoItem,
  TurnoEstado,
  TurnoOtroItem,
  TurnoTipo,
} from "@/lib/types";

export type TurnoInput = {
  fecha: string;
  hora: string;
  duracionMin: number;
  atiendeId: string | null;
  cliente: ClienteSeleccion;
  tipo: TurnoTipo;
  /** Solo "retira": ticket listo que se viene a retirar. */
  ticketId: number | null;
  /** Solo "compra". */
  celularIds: string[];
  itemsOtros: TurnoOtroItem[];
  pagos: Pago[];
  reservarStock: boolean;
  nota: string;
};

async function datosDe(data: TurnoInput) {
  const cliente =
    data.cliente.tipo === "libre"
      ? { id: null, nombre: data.cliente.nombre }
      : await resolveCliente(data.cliente);
  return {
    fecha: data.fecha,
    hora: data.hora,
    duracionMin: data.duracionMin,
    atiendeId: data.atiendeId,
    cliente: cliente.nombre,
    clienteId: cliente.id,
    tipo: data.tipo,
    ticketId: data.ticketId,
    celularIds: data.celularIds,
    itemsOtros: data.itemsOtros,
    pagos: data.pagos,
    reservarStock: data.reservarStock,
    nota: data.nota,
  };
}

function revalidar() {
  revalidatePath("/agenda");
  revalidatePath("/inventario");
  revalidatePath("/dashboard");
}

export async function createTurnoAction(data: TurnoInput) {
  await requireEscritura();
  const turno = await createTurno(await datosDe(data));
  revalidar();
  return turno;
}

export async function updateTurnoAction(id: string, data: TurnoInput) {
  await requireEscritura();
  const turno = await updateTurno(id, await datosDe(data));
  revalidar();
  return turno;
}

export async function setTurnoEstadoAction(id: string, estado: TurnoEstado) {
  await requireEscritura();
  const turno = await setTurnoEstado(id, estado);
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return turno;
}

export async function deleteTurnoAction(id: string) {
  await requireRoleEscritura("admin");
  await deleteTurno(id);
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}

// ── Pedidos ─────────────────────────────────────────────────────

export type PedidoInput = {
  cliente: ClienteSeleccion;
  items: PedidoItem[];
  /** `null` = no abonó seña. Monto en la moneda de la caja. */
  sena: SenaCaja | null;
  fechaEntrega: string;
  nota: string;
};

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

async function pedidoDatosDe(data: PedidoInput) {
  // El server nunca confía en el cliente: limpia filas vacías, revalida con la
  // misma lógica pura que el dialog y recién ahí normaliza.
  const items = limpiarItems(data.items);
  // La seña (contra el total) la valida `lib/db/pedidos.ts`, que la pasa a
  // USD desde la caja elegida.
  const error = errorPedido({ items, senaUsd: 0 });
  if (error) throw new Error(error);
  if (!FECHA_RE.test(data.fechaEntrega)) throw new Error("Fecha de entrega inválida.");
  const cliente =
    data.cliente.tipo === "libre"
      ? { id: null, nombre: data.cliente.nombre.trim() }
      : await resolveCliente(data.cliente);
  if (!cliente.nombre) throw new Error("Falta el cliente.");
  return {
    cliente: cliente.nombre,
    clienteId: cliente.id,
    items: normalizarItems(items),
    sena: data.sena
      ? { cajaId: data.sena.cajaId, monto: data.sena.monto, cotizacion: data.sena.cotizacion }
      : null,
    fechaEntrega: data.fechaEntrega,
    nota: data.nota,
  };
}

export async function createPedidoAction(data: PedidoInput) {
  await requireEscritura();
  const pedido = await createPedido(await pedidoDatosDe(data));
  revalidatePath("/agenda");
  revalidatePath("/cajas");
  return pedido;
}

export async function updatePedidoAction(id: string, data: PedidoInput) {
  await requireEscritura();
  const pedido = await updatePedido(id, await pedidoDatosDe(data));
  revalidatePath("/agenda");
  revalidatePath("/cajas");
  return pedido;
}

export async function setPedidoEstadoAction(id: string, estado: PedidoEstado) {
  await requireEscritura();
  await setPedidoEstado(id, estado);
  revalidatePath("/agenda");
}

export async function deletePedidoAction(id: string) {
  await requireRoleEscritura("admin");
  await deletePedido(id);
  revalidatePath("/agenda");
  revalidatePath("/cajas");
}
