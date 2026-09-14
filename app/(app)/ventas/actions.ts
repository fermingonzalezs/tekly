"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createCliente } from "@/lib/db/clientes";
import { createVenta } from "@/lib/db/ventas";
import type { Pago, VentaItem } from "@/lib/types";

export async function createVentaAction(input: {
  clienteId?: string;
  clienteNombre?: string;
  clienteNuevo?: { nombre: string; telefono?: string };
  vendedorId: string;
  procedencia?: string;
  items: VentaItem[];
  totalUsd: number;
  pagos: Pago[];
  margenPct: number;
  tipo: "venta" | "reparacion";
}) {
  await requireUser();

  let clienteId: string;
  let clienteNombre: string;
  if (input.clienteNuevo) {
    const nuevo = await createCliente(input.clienteNuevo);
    clienteId = nuevo.id;
    clienteNombre = nuevo.nombre;
  } else {
    clienteId = input.clienteId!;
    clienteNombre = input.clienteNombre!;
  }

  const venta = await createVenta({
    clienteId,
    cliente: clienteNombre,
    vendedorId: input.vendedorId,
    procedencia: input.procedencia,
    items: input.items,
    totalUsd: input.totalUsd,
    pagos: input.pagos,
    margenPct: input.margenPct,
    tipo: input.tipo,
  });
  revalidatePath("/ventas");
  return venta;
}
