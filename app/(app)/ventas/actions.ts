"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth";
import { resolveCliente } from "@/lib/db/clientes";
import { createVenta, deleteVenta, type DeleteVentaOpts } from "@/lib/db/ventas";
import type { CanjeEquipo, ClienteSeleccion, Pago, VentaItem } from "@/lib/types";

export async function createVentaAction(input: {
  cliente: Exclude<ClienteSeleccion, { tipo: "libre" }>;
  vendedorId: string;
  vendedorNombre: string;
  procedencia?: string;
  items: VentaItem[];
  totalUsd: number;
  pagos: (Pago & { canje?: CanjeEquipo })[];
  margenPct: number;
  tipo: "venta" | "reparacion";
  dolarVenta: number;
}) {
  await requireUser();

  const cliente = await resolveCliente(input.cliente);

  const venta = await createVenta({
    clienteId: cliente.id,
    cliente: cliente.nombre,
    vendedorId: input.vendedorId,
    vendedorNombre: input.vendedorNombre,
    procedencia: input.procedencia,
    items: input.items,
    totalUsd: input.totalUsd,
    pagos: input.pagos,
    margenPct: input.margenPct,
    tipo: input.tipo,
    dolarVenta: input.dolarVenta,
  });
  revalidatePath("/ventas");
  revalidatePath("/inventario");
  revalidatePath("/cajas");
  revalidatePath("/cuentas-corrientes");
  revalidatePath("/compras");
  return venta;
}

export async function deleteVentaAction(id: string, opts: DeleteVentaOpts) {
  await requireRole("admin");
  await deleteVenta(id, opts);
  revalidatePath("/ventas");
  revalidatePath("/inventario");
  revalidatePath("/cajas");
  revalidatePath("/cuentas-corrientes");
  revalidatePath("/compras");
}
