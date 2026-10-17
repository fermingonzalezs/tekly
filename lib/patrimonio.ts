import type {
  Caja,
  Celular,
  ClienteOpcion,
  Compra,
  MovimientoCaja,
  MovimientoCC,
  Notebook,
  OtroItem,
  Repuesto,
  Ticket,
} from "@/lib/types";
import { saldoPorCaja } from "@/lib/cajas";
import { saldoDe } from "@/lib/cuentas-corrientes";
import { valorInventario, type CategoriaInventario } from "@/lib/inventario";
import { medioPago } from "@/lib/status";

/** Estado de situación patrimonial (a hoy). Lógica **pura** -- sin Supabase
 *  ni `window` -- para testearla sin red; `lib/db/patrimonio.ts` trae las
 *  listas y `app/(app)/patrimonio/page.tsx` dibuja el resultado.
 *
 *  Es un balance **gerencial**: la caja USD va tal cual y la caja ARS se
 *  convierte con la cotización de HOY (el blue de Ventas); el inventario va a
 *  COSTO, excluyendo vendidos y extraviados. No incluye impuestos, sueldos ni
 *  cuentas a pagar a proveedores (Tekly no las modela). */

const TOP = 8;
/** Debajo de este umbral un saldo se considera cero (ruido de redondeo). */
const EPS = 0.005;

export type PatrimonioCaja = {
  id: string;
  nombre: string;
  moneda: "usd" | "ars";
  /** Label del medio de pago de la caja (ej. "Efectivo (pesos)"). */
  medio: string;
  activa: boolean;
  /** Neto en la moneda de la caja. */
  saldo: number;
  /** Equivalente en USD a la cotización de hoy; `null` si es ARS y la
   *  cotización no es válida (se muestra su saldo en pesos, sin convertir). */
  enUsd: number | null;
};

export type PatrimonioTop = { clienteId: string; nombre: string; saldo: number };

export type PatrimonioCategoria = CategoriaInventario;

export type Patrimonio = {
  cotizacion: number;
  cotizacionValida: boolean;
  activo: {
    total: number;
    disponibilidades: { total: number; cajas: PatrimonioCaja[] };
    creditos: { total: number; cantidadClientes: number; top: PatrimonioTop[] };
    inventario: { total: number; porCategoria: PatrimonioCategoria[] };
    anticipos: { total: number; cantidad: number };
  };
  pasivo: {
    total: number;
    saldosAFavor: { total: number; cantidadClientes: number; top: PatrimonioTop[] };
  };
  patrimonioNeto: number;
  memo: {
    inventarioAPrecioVenta: number;
    margenPotencial: number;
    trabajosEnCurso: { total: number; cantidad: number };
    extraviadoACosto: number;
    /** Compras a proveedor «pendientes» **sin egreso de caja** (anteriores a
     *  que la compra eligiera caja): no se pagaron desde Tekly, así que no
     *  son un anticipo y no suman al activo. */
    comprasPendientesSinPago: { total: number; cantidad: number };
    /** Movimientos de caja ARS sin `cotizacion` guardada (no se pudieron
     *  convertir nunca, ni con la de hoy). */
    movimientosSinCotizacion: number;
  };
};

export type PatrimonioInput = {
  cotizacion: number;
  cajas: Caja[];
  movimientos: MovimientoCaja[];
  movimientosCC: Pick<MovimientoCC, "clienteId" | "tipo" | "montoUsd">[];
  clientes: Pick<ClienteOpcion, "id" | "nombre">[];
  celulares: Celular[];
  notebooks: Notebook[];
  repuestos: Repuesto[];
  otros: OtroItem[];
  compras: Compra[];
  tickets: Ticket[];
};

export function armarPatrimonio(input: PatrimonioInput): Patrimonio {
  const cotizacionValida =
    Number.isFinite(input.cotizacion) && input.cotizacion > 0;

  // ── Disponibilidades ───────────────────────────────────────────────
  const saldos = new Map(
    saldoPorCaja(input.movimientos, input.cajas).map((s) => [s.cajaId, s.saldo]),
  );
  const cajas: PatrimonioCaja[] = [];
  for (const c of input.cajas) {
    const saldo = saldos.get(c.id) ?? 0;
    const enUsd = c.moneda === "usd" ? saldo : cotizacionValida ? saldo / input.cotizacion : null;
    const fila: PatrimonioCaja = {
      id: c.id,
      nombre: c.nombre,
      moneda: c.moneda,
      medio: medioPago[c.medioPago].label,
      activa: c.activa,
      saldo,
      enUsd,
    };
    cajas.push(fila);
  }
  cajas.sort((a, b) => (b.enUsd ?? b.saldo) - (a.enUsd ?? a.saldo));
  const disponibilidadesTotal = cajas.reduce((a, c) => a + (c.enUsd ?? 0), 0);

  // ── Créditos (clientes que deben) y saldos a favor (pasivo) ─────────
  // Se recorre por los clientes que **tienen movimientos** (no por la lista
  // de clientes activos): una deuda o un saldo a favor de un cliente dado de
  // baja sigue siendo real y no puede desaparecer del balance.
  const nombres = new Map(input.clientes.map((c) => [c.id, c.nombre]));
  const idsConMovimientos = [...new Set(input.movimientosCC.map((m) => m.clienteId))];
  const saldosClientes = idsConMovimientos.map((id) => ({
    clienteId: id,
    nombre: nombres.get(id) ?? "Cliente dado de baja",
    saldo: saldoDe(input.movimientosCC, id),
  }));
  const deudores = saldosClientes
    .filter((s) => s.saldo > EPS)
    .sort((a, b) => b.saldo - a.saldo);
  const aFavor = saldosClientes
    .filter((s) => s.saldo < -EPS)
    .sort((a, b) => a.saldo - b.saldo);

  // ── Inventario a costo ─────────────────────────────────────────────
  const inv = valorInventario({
    celulares: input.celulares,
    notebooks: input.notebooks,
    repuestos: input.repuestos,
    otros: input.otros,
  });

  // ── Anticipos a proveedores (compra pagada, mercadería sin llegar) ──
  // Solo cuentan las que **salieron de una caja** (`cajaId`): una compra vieja
  // pendiente sin egreso registrado no está pagada desde Tekly.
  const pendientes = input.compras.filter(
    (c) => c.origen === "proveedor" && c.estado === "pendiente",
  );
  const anticipos = pendientes.filter((c) => !!c.cajaId);
  const sinPago = pendientes.filter((c) => !c.cajaId);
  const anticiposTotal = anticipos.reduce((a, c) => a + c.totalUsd, 0);

  // ── Memo ───────────────────────────────────────────────────────────
  const abiertos = input.tickets.filter((t) => t.estado !== "entregado");
  const cajaPorId = new Map(input.cajas.map((c) => [c.id, c]));
  const movimientosSinCotizacion = input.movimientos.filter((m) => {
    const caja = cajaPorId.get(m.cajaId);
    return caja?.moneda === "ars" && (m.cotizacion == null || m.cotizacion <= 0);
  }).length;

  const creditosTotal = deudores.reduce((a, s) => a + s.saldo, 0);
  const saldosAFavorTotal = aFavor.reduce((a, s) => a + Math.abs(s.saldo), 0);
  const activoTotal =
    disponibilidadesTotal + creditosTotal + inv.total + anticiposTotal;
  const pasivoTotal = saldosAFavorTotal;

  return {
    cotizacion: input.cotizacion,
    cotizacionValida,
    activo: {
      total: activoTotal,
      disponibilidades: {
        total: disponibilidadesTotal,
        cajas,
      },
      creditos: {
        total: creditosTotal,
        cantidadClientes: deudores.length,
        top: deudores.slice(0, TOP),
      },
      inventario: {
        total: inv.total,
        porCategoria: inv.porCategoria,
      },
      anticipos: { total: anticiposTotal, cantidad: anticipos.length },
    },
    pasivo: {
      total: pasivoTotal,
      saldosAFavor: {
        total: saldosAFavorTotal,
        cantidadClientes: aFavor.length,
        top: aFavor.slice(0, TOP),
      },
    },
    patrimonioNeto: activoTotal - pasivoTotal,
    memo: {
      inventarioAPrecioVenta: inv.valorVenta,
      margenPotencial: inv.margenPotencial,
      trabajosEnCurso: {
        total: abiertos.reduce((a, t) => a + t.presupuestoUsd, 0),
        cantidad: abiertos.length,
      },
      extraviadoACosto: inv.extraviadoACosto,
      comprasPendientesSinPago: {
        total: sinPago.reduce((a, c) => a + c.totalUsd, 0),
        cantidad: sinPago.length,
      },
      movimientosSinCotizacion,
    },
  };
}
