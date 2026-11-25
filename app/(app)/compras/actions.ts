"use server";

import { revalidatePath } from "next/cache";
import { requireRoleEscritura } from "@/lib/auth";
import { createCompra, marcarRecibida, deleteCompra, pasarCanjeAlStock } from "@/lib/db/compras";
import type { CelularInput } from "@/lib/db/inventario";
import type { ItemCompraStock } from "@/lib/compras";
import type { Compra, CompraItem, MedioPago } from "@/lib/types";

export async function createCompraAction(data: {
  proveedor: string;
  items: CompraItem[];
  totalUsd: number;
  medioPago: MedioPago;
  cajaId?: string;
  montoArs?: number;
  cotizacion?: number;
  /** Plan 025: con esto la compra sube al stock (el server recalcula
   * `items`/`totalUsd`). */
  stock?: ItemCompraStock[];
  costosAdicionalesUsd?: number;
  notas?: string;
}): Promise<{ ok: true; compra: Compra } | { ok: false; error: string }> {
  const user = await requireRoleEscritura("admin", "tecnico");
  try {
    // Desde la pantalla de Compras siempre es compra a proveedor (los canjes
    // los crea solo Nueva venta), y el proveedor es obligatorio.
    if (!data.proveedor?.trim()) return { ok: false, error: "El proveedor es obligatorio." };
    const compra = await createCompra({ ...data, origen: "proveedor", usuarioNombre: user.nombre });
    revalidatePath("/compras");
    revalidatePath("/cajas");
    if (data.stock) revalidatePath("/inventario");
    return { ok: true, compra };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar la compra." };
  }
}

export async function marcarRecibidaAction(id: string) {
  await requireRoleEscritura("admin", "tecnico");
  const compra = await marcarRecibida(id);
  revalidatePath("/compras");
  return compra;
}

export async function deleteCompraAction(
  id: string,
  opciones: { eliminarMovimientoCaja: boolean; quitarDelStock: boolean },
) {
  await requireRoleEscritura("admin");
  const res = await deleteCompra(id, opciones);
  revalidatePath("/compras");
  revalidatePath("/cajas");
  if (opciones.quitarDelStock) revalidatePath("/inventario");
  return res;
}

/** Pasa al inventario un celular recibido en canje (elige la variante
 * recién acá). Mismos roles que crear una compra. */
export async function pasarCanjeAlStockAction(
  compraId: string,
  celular: CelularInput,
): Promise<{ ok: true; celularId: string } | { ok: false; error: string }> {
  const user = await requireRoleEscritura("admin", "tecnico");
  try {
    const { celularId } = await pasarCanjeAlStock(compraId, celular, user.nombre);
    revalidatePath("/compras");
    revalidatePath("/inventario");
    return { ok: true, celularId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo pasar al stock." };
  }
}
