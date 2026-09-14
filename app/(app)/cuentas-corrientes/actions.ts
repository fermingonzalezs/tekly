"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createMovimientoCC } from "@/lib/db/cuentas-corrientes";

export async function createMovimientoCCAction(data: {
  clienteId: string;
  tipo: "cargo" | "pago";
  concepto: string;
  montoUsd: number;
}) {
  await requireUser();
  const mov = await createMovimientoCC(data);
  revalidatePath("/cuentas-corrientes");
  return mov;
}
