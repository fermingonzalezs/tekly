"use server";

import { revalidatePath } from "next/cache";
import { requireEscritura, requireRoleEscritura } from "@/lib/auth";
import { resolveCliente } from "@/lib/db/clientes";
import { createVenta, deleteVenta, listUsuariosVenta, type DeleteVentaOpts } from "@/lib/db/ventas";
import { resolverVendedor } from "@/lib/ventas";
import { resolveTiendaId } from "@/lib/db/tiendas";
import { getNegocio } from "@/lib/db/configuracion";
import type {
  CanjeEquipo,
  ClienteSeleccion,
  ModalidadVenta,
  Pago,
  TiendaSeleccion,
  VentaItem,
} from "@/lib/types";

export async function createVentaAction(input: {
  cliente: Exclude<ClienteSeleccion, { tipo: "libre" }>;
  vendedorId: string;
  vendedorNombre: string;
  /** Omitido = la tienda principal. */
  tienda?: TiendaSeleccion;
  procedencia?: string;
  modalidad: ModalidadVenta;
  items: VentaItem[];
  totalUsd: number;
  pagos: (Pago & { canje?: CanjeEquipo })[];
  margenPct: number;
  tipo: "venta" | "reparacion";
  dolarVenta: number;
}) {
  await requireEscritura();

  // Cualquier rol puede registrar la venta a nombre de otro usuario activo
  // de la organización o escribir el vendedor a mano. El nombre de un
  // usuario se toma de `profiles`, nunca del cliente.
  const vendedor = resolverVendedor(
    { vendedorId: input.vendedorId, vendedorNombre: input.vendedorNombre },
    await listUsuariosVenta(),
  );
  if (!vendedor.ok) throw new Error(vendedor.error);
  const { vendedorId, vendedorNombre } = vendedor;
  const tiendaId = await resolveTiendaId(input.tienda, (await getNegocio()).nombre);

  const cliente = await resolveCliente(input.cliente);

  const venta = await createVenta({
    clienteId: cliente.id,
    cliente: cliente.nombre,
    vendedorId,
    vendedorNombre,
    tiendaId,
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
  await requireRoleEscritura("admin");
  const aviso = await deleteVenta(id, opts);
  revalidatePath("/ventas");
  revalidatePath("/inventario");
  revalidatePath("/cajas");
  revalidatePath("/cuentas-corrientes");
  revalidatePath("/compras");
  revalidatePath("/dashboard");
  return aviso;
}
