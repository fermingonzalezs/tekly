"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth";
import { createCompra, marcarRecibida, deleteCompra } from "@/lib/db/compras";
import type { CompraItem, MedioPago } from "@/lib/types";

export async function createCompraAction(data: {
  proveedor: string;
  items: CompraItem[];
  totalUsd: number;
  medioPago: MedioPago;
  cajaId?: string;
  montoArs?: number;
  cotizacion?: number;
}) {
  const user = await requireUser();
  const compra = await createCompra({ ...data, usuarioNombre: user.nombre });
  revalidatePath("/compras");
  revalidatePath("/cajas");
  return compra;
}

export async function marcarRecibidaAction(id: string) {
  await requireUser();
  const compra = await marcarRecibida(id);
  revalidatePath("/compras");
  return compra;
}

export async function deleteCompraAction(id: string, eliminarMovimientoCaja: boolean) {
  await requireRole("admin");
  await deleteCompra(id, eliminarMovimientoCaja);
  revalidatePath("/compras");
  revalidatePath("/cajas");
}
