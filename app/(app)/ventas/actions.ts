"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth";
import { resolveCliente } from "@/lib/db/clientes";
import { createVenta, deleteVenta, type DeleteVentaOpts } from "@/lib/db/ventas";
import type { CanjeEquipo, ClienteSeleccion, ModalidadVenta, Pago, VentaItem } from "@/lib/types";

export async function createVentaAction(input: {
  cliente: Exclude<ClienteSeleccion, { tipo: "libre" }>;
  vendedorId: string;
  vendedorNombre: string;
  procedencia?: string;
  modalidad: ModalidadVenta;
  items: VentaItem[];
  totalUsd: number;
  pagos: (Pago & { canje?: CanjeEquipo })[];
  margenPct: number;
  tipo: "venta" | "reparacion";
  dolarVenta: number;
}) {
  const user = await requireUser();

  // Un vendedor/técnico solo registra ventas a su propio nombre; el admin
  // puede elegir a cualquiera. Se ignora lo que venga del cliente -- la
  // UI ya lo respeta (campo fijo), esto es la validación de verdad.
  const vendedorId = user.rol === "admin" ? input.vendedorId : user.id;
  const vendedorNombre = user.rol === "admin" ? input.vendedorNombre : user.nombre;

  const cliente = await resolveCliente(input.cliente);

  const venta = await createVenta({
    clienteId: cliente.id,
    cliente: cliente.nombre,
    vendedorId,
    vendedorNombre,
    procedencia: input.procedencia,
    modalidad: input.modalidad,
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
  revalidatePath("/dashboard");
}
