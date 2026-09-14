"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { resolveCliente } from "@/lib/db/clientes";
import { createVenta } from "@/lib/db/ventas";
import type { ClienteSeleccion, Pago, VentaItem } from "@/lib/types";

export async function createVentaAction(input: {
  cliente: Exclude<ClienteSeleccion, { tipo: "libre" }>;
  vendedorId: string;
  procedencia?: string;
  items: VentaItem[];
  totalUsd: number;
  pagos: Pago[];
  margenPct: number;
  tipo: "venta" | "reparacion";
}) {
  await requireUser();

  const cliente = await resolveCliente(input.cliente);

  const venta = await createVenta({
    clienteId: cliente.id,
    cliente: cliente.nombre,
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
