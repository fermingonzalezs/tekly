/** Operaciones puras sobre el `DemoState` (plan 014, paso 2): alta y baja de
 * venta sin React y sin Supabase. Replican el efecto de `createVenta`/
 * `deleteVenta` de `lib/db/ventas.ts` (contrato, no implementación): numerar
 * `V-<n>`, marcar equipos vendidos, descontar repuestos, snapshot ARS y
 * coherencia de los flags de movimiento. **No** generan movimientos de caja
 * ni de cuenta corriente reales (decisión 5 del plan). */

import type {
  CanjeEquipo,
  ClienteSeleccion,
  ModalidadVenta,
  Pago,
  Venta,
  VentaItem,
} from "@/lib/types";
import { margenVenta, montoConRecargo } from "@/lib/ventas";
import { fechaDisplayDe, fechaISOLocal, type DemoState } from "@/lib/demo/seed";

export type CrearVentaDemoInput = {
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
};

/** Siguiente id `demo-cliente-<n>` libre (evita chocar con los del seed o con
 * altas previas). */
function proximoClienteId(clientes: DemoState["clientes"]): string {
  const max = clientes.reduce((m, c) => {
    const match = /^demo-cliente-(\d+)$/.exec(c.id);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `demo-cliente-${max + 1}`;
}

export function crearVentaDemo(
  state: DemoState,
  input: CrearVentaDemoInput,
  hoy: Date,
): { state: DemoState; venta: Venta } {
  const numero = state.contadorVentas + 1;
  const fechaISO = fechaISOLocal(hoy);

  // ── Cliente ── "nuevo" se persiste recién acá (misma promesa diferida que
  // `ClientePicker`); "existente" se resuelve contra la lista del store.
  let clientes = state.clientes;
  const seleccion = input.cliente;
  let clienteId: string;
  let clienteNombre: string;
  if (seleccion.tipo === "nuevo") {
    clienteId = proximoClienteId(state.clientes);
    clienteNombre = seleccion.nombre;
    clientes = [
      ...state.clientes,
      {
        id: clienteId,
        nombre: seleccion.nombre,
        telefono: seleccion.telefono ?? "",
        email: "",
      },
    ];
  } else {
    clienteId = seleccion.id;
    clienteNombre =
      state.clientes.find((c) => c.id === seleccion.id)?.nombre ??
      seleccion.nombre;
  }

  // ── Pagos ── snapshot ARS igual que `createVenta`; el detalle de canje
  // nunca se persiste en `Venta.pagos`. Cuenta corriente se conserva como
  // pago (sin movimiento real), canje no debería llegar en demo.
  const pagos: Pago[] = input.pagos.map((pago) => {
    const { canje: _canje, ...resto } = pago;
    void _canje;
    const base: Pago = { ...resto };
    if (base.caja === "ars" && base.cajaId) {
      return {
        ...base,
        cotizacion: input.dolarVenta,
        montoArs: Math.round(
          montoConRecargo(base.montoUsd, base.recargoPct) * input.dolarVenta,
        ),
      };
    }
    return base;
  });

  // ── Equipos vendidos y repuestos consumidos ──
  const equipoIds = new Set(
    input.items.map((i) => i.equipoId).filter((x): x is string => !!x),
  );
  const equipos = state.equipos.map((e): typeof e =>
    equipoIds.has(e.id) ? { ...e, estado: "vendido" } : e,
  );

  const stockUsado = new Map<string, number>();
  for (const item of input.items) {
    for (const r of item.repuestos ?? []) {
      stockUsado.set(r.repuestoId, (stockUsado.get(r.repuestoId) ?? 0) + r.cantidad);
    }
  }
  const repuestos = state.repuestos.map((r): typeof r =>
    stockUsado.has(r.id)
      ? { ...r, stock: r.stock - (stockUsado.get(r.id) as number) }
      : r,
  );

  const venta: Venta = {
    id: `V-${numero}`,
    fecha: fechaDisplayDe(fechaISO),
    fechaISO,
    clienteId,
    cliente: clienteNombre,
    vendedorId: input.vendedorId,
    vendedor: input.vendedorNombre,
    procedencia: input.procedencia,
    modalidad: input.modalidad,
    items: input.items,
    totalUsd: input.totalUsd,
    pagos,
    margenPct: margenVenta(input.items).margenPct ?? 0,
    tipo: input.tipo,
    tieneMovimientoCaja: pagos.some(
      (p) => p.medio !== "cuenta_corriente" && !!p.cajaId,
    ),
    tieneMovimientoCC: pagos.some((p) => p.medio === "cuenta_corriente"),
  };

  return {
    state: {
      ...state,
      ventas: [venta, ...state.ventas],
      equipos,
      clientes,
      repuestos,
      contadorVentas: numero,
    },
    venta,
  };
}

export function eliminarVentaDemo(
  state: DemoState,
  id: string,
  opts: { restituirEquipos: boolean; restituirRepuestos: boolean },
): DemoState {
  const venta = state.ventas.find((v) => v.id === id);
  if (!venta) return state;

  let equipos = state.equipos;
  if (opts.restituirEquipos) {
    const ids = new Set(
      venta.items.map((i) => i.equipoId).filter((x): x is string => !!x),
    );
    equipos = state.equipos.map((e): typeof e =>
      ids.has(e.id) ? { ...e, estado: "disponible" } : e,
    );
  }

  let repuestos = state.repuestos;
  if (opts.restituirRepuestos) {
    const devueltos = new Map<string, number>();
    for (const item of venta.items) {
      for (const r of item.repuestos ?? []) {
        devueltos.set(r.repuestoId, (devueltos.get(r.repuestoId) ?? 0) + r.cantidad);
      }
    }
    repuestos = state.repuestos.map((r): typeof r =>
      devueltos.has(r.id)
        ? { ...r, stock: r.stock + (devueltos.get(r.id) as number) }
        : r,
    );
  }

  return {
    ...state,
    ventas: state.ventas.filter((v) => v.id !== id),
    equipos,
    repuestos,
  };
}
