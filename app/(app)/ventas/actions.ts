"use server";

import { revalidatePath } from "next/cache";
import { requireEscritura, requireRoleEscritura } from "@/lib/auth";
import { resolveCliente } from "@/lib/db/clientes";
import { createVenta, deleteVenta, listUsuariosVenta, type DeleteVentaOpts } from "@/lib/db/ventas";
import { errorAjuste, resolverVendedor } from "@/lib/ventas";
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
  /** Ítems con precio de lista (plan 026 revisado). */
  items: VentaItem[];
  /** Descuento sobre el total (U$, ≥ 0). Los regalos van por ítem. */
  ajusteUsd: number;
  /** La venta entera es un regalo (compatibilidad; Nueva venta ya no lo usa). */
  regalo?: boolean;
  /** Ignorados: `createVenta` recalcula total y margen. */
  totalUsd?: number;
  pagos: (Pago & { canje?: CanjeEquipo })[];
  margenPct?: number;
  tipo: "venta" | "reparacion";
  dolarVenta: number;
}) {
  await requireEscritura();

  // Plan 026 (revisado): la diferencia (descuento o recargo) se valida acá
  // además de en `createVenta`; el regalo es de la venta entera.
  if (input.items.length === 0) throw new Error("La venta necesita al menos un ítem.");
  if (!input.regalo) {
    const subtotal = input.items.reduce(
      (a, i) => a + Math.max(0, i.precioUsd) * i.cantidad,
      0,
    );
    const errorAjusteMsg = errorAjuste(subtotal, input.ajusteUsd ?? 0);
    if (errorAjusteMsg) throw new Error(errorAjusteMsg);
  }

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
    ajusteUsd: input.ajusteUsd ?? 0,
    regalo: input.regalo,
    pagos: input.pagos,
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
