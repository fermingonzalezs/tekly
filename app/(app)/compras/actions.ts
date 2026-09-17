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
  montoArs?: number;
  cotizacion?: number;
}) {
  await requireUser();
  const compra = await createCompra(data);
  revalidatePath("/compras");
  return compra;
}

export async function marcarRecibidaAction(id: string) {
  await requireUser();
  const compra = await marcarRecibida(id);
  revalidatePath("/compras");
  return compra;
}

export async function deleteCompraAction(id: string) {
  await requireRole("admin");
  await deleteCompra(id);
  revalidatePath("/compras");
}
