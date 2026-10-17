"use server";

import { revalidatePath } from "next/cache";
import { requireEscritura } from "@/lib/auth";
import { resolverRecuento } from "@/lib/db/inventario";
import type { RecuentoResolucion } from "@/lib/types";

export async function resolverRecuentoAction(
  id: string,
  resoluciones: Record<string, RecuentoResolucion>,
) {
  await requireEscritura();
  const recuento = await resolverRecuento(id, resoluciones);
  // Resolver un recuento toca celulares/repuestos/otros_items -- revalida
  // Inventario también, no solo esta página.
  revalidatePath("/recuentos");
  revalidatePath("/inventario");
  return recuento;
}
