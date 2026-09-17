"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth";
import { resolveCliente } from "@/lib/db/clientes";
import { createMovimientoCC, deleteMovimientoCC } from "@/lib/db/cuentas-corrientes";
import type { ClienteSeleccion } from "@/lib/types";

export async function createMovimientoCCAction(data: {
  cliente: Exclude<ClienteSeleccion, { tipo: "libre" }>;
  tipo: "cargo" | "pago";
  concepto: string;
  montoUsd: number;
}) {
  await requireUser();
  const cliente = await resolveCliente(data.cliente);
  const mov = await createMovimientoCC({
    clienteId: cliente.id,
    tipo: data.tipo,
    concepto: data.concepto,
    montoUsd: data.montoUsd,
  });
  revalidatePath("/cuentas-corrientes");
  return mov;
}

export async function deleteMovimientoCCAction(id: string) {
  await requireRole("admin");
  await deleteMovimientoCC(id);
  revalidatePath("/cuentas-corrientes");
}
