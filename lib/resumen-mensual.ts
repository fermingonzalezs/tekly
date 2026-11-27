/** Resumen mensual (plan 022): lógica pura, sin Supabase. Reusa los
 *  `resumen*` de Analíticas para el período del mes (misma definición de
 *  facturación, margen, cobrado de reparaciones…, así los números del resumen
 *  coinciden con los de la pantalla) y arma un objeto serializable y chico que
 *  se guarda congelado en `resumenes_mensuales.datos` (`version` = shape). */

import type {
  Caja,
  Celular,
  Cliente,
  Compra,
  MovimientoCaja,
  MovimientoCC,
  Notebook,
  OtroItem,
  Repuesto,
  Ticket,
  Turno,
  Venta,
} from "@/lib/types";
import type { MovimientoStockBulk } from "@/lib/db/inventario";
import { enRango, hoyISO, sumarDias, type Rango } from "@/lib/date-presets";
import {
  resumenClientes,
  resumenFinanzas,
  resumenInventario,
  resumenReparaciones,
  resumenTurnos,
  resumenVentas,
  type ContextoAnaliticas,
} from "@/lib/analiticas-resumen";
import { armarPatrimonio } from "@/lib/patrimonio";
import { medioPago as medioPagoCfg } from "@/lib/status";
import { montosPorMedio } from "@/lib/ventas";

export const RESUMEN_VERSION = 1;

/** Días después del cierre del mes dentro de los cuales las fotos (inventario,
 *  saldos, caja, patrimonio) se consideran fieles al cierre. */
export const DIAS_FOTO_FIABLE = 3;

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const redondear = (n: number) => Math.round(n * 100) / 100;

export function esPeriodo(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

/** `"2026-09"` → `{ desde: "2026-09-01", hasta: "2026-09-30" }`. */
export function rangoDeMes(periodo: string): Rango {
  const [y, m] = periodo.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { desde: `${periodo}-01`, hasta: `${periodo}-${String(ultimo).padStart(2, "0")}` };
}

export function periodoAnteriorA(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** El mes que termina de cerrarse "hoy" (hora argentina): el anterior al actual. */
export function periodoACerrar(hoy: Date): string {
  return periodoAnteriorA(hoyISO(hoy).slice(0, 7));
}

export function etiquetaPeriodo(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  return `${MESES[m - 1]} de ${y}`;
}

type Fila = { label: string; value: number };

export type ResumenMensual = {
  version: number;
  periodo: string;
  rango: Rango;
  foto: { al: string; fiable: boolean };
  cotizacion: { valor: number | null };
  objetivo: { objetivoUsd: number; cumplidoPct: number | null } | null;
  ventas: {
    facturacionUsd: number;
    operaciones: number;
    ticketPromedioUsd: number;
    margenPct: number | null;
    gananciaUsd: number;
    deltas: { facturacion?: number; operaciones?: number; ticketPromedio?: number; margen?: number };
    porRubro: Fila[];
    porVendedor: { label: string; value: number; operaciones: number }[];
    porMedio: Fila[];
    porCanal: Fila[];
  };
  reparaciones: {
    tickets: number;
    cobradoUsd: number;
    cobradoCajaUsd: number;
    cobradoCuentaCorrienteUsd: number;
    gastoRepuestosUsd: number;
    gananciaUsd: number;
    porFalla: { falla: string; totalUsd: number; tickets: number }[];
  };
  compras: { totalUsd: number; cantidad: number; porProveedor: Fila[]; canjes: number };
  caja: {
    ingresosUsd: number;
    egresosUsd: number;
    netoUsd: number;
    movimientosArsSinCotizacion: number;
  };
  cuentasCorrientes: {
    cargosUsd: number;
    pagosUsd: number;
    /** Foto: lo que le deben al negocio / lo que el negocio debe, al generar. */
    porCobrarUsd: number;
    saldosAFavorUsd: number;
  };
  inventario: {
    /** Foto al cierre (celulares + repuestos + otros, como Analíticas). */
    valorUsd: number;
    unidades: number;
    inmovilizadoUsd: number;
    porCategoria: { categoria: string; unidades: number; valorUsd: number }[];
    entradas: number;
    salidas: number;
    bajas: number;
  };
  clientes: { total: number; nuevos: number; activos: number; enRiesgo: number; tasaRecurrenciaPct: number };
  turnos: { total: number; confirmados: number; cancelados: number; pendientes: number; porTipo: Fila[] };
  patrimonio: {
    activoUsd: number;
    pasivoUsd: number;
    netoUsd: number;
    disponibilidadesUsd: number;
    creditosUsd: number;
    inventarioUsd: number;
    anticiposUsd: number;
  } | null;
};

export type InputResumenMensual = {
  periodo: string;
  /** Momento de la generación (define si las fotos son fieles al cierre). */
  hoy: Date;
  /** Blue venta usado, o `null` si no hay (el patrimonio no se arma). */
  cotizacion: number | null;
  objetivoMesUsd: number;
  ventas: Venta[];
  tickets: Ticket[];
  movimientos: MovimientoCaja[];
  movimientosCC: MovimientoCC[];
  cajas: Caja[];
  compras: Compra[];
  celulares: Celular[];
  notebooks: Notebook[];
  repuestos: Repuesto[];
  otros: OtroItem[];
  movimientosStock: MovimientoStockBulk[];
  clientes: Cliente[];
  /** Turnos del mes (ya filtrados por rango). */
  turnos: Turno[];
};

const top = <T extends { value: number }>(filas: T[], n: number) =>
  [...filas].sort((a, b) => b.value - a.value).slice(0, n);

export function armarResumenMensual(i: InputResumenMensual): ResumenMensual {
  const rango = rangoDeMes(i.periodo);
  const ctx: ContextoAnaliticas = {
    rango,
    rangoAnterior: rangoDeMes(periodoAnteriorA(i.periodo)),
    preset: "mes_anterior",
    hoy: i.hoy,
  };
  const hoy = hoyISO(i.hoy);
  const fiable = hoy > rango.hasta && hoy <= sumarDias(rango.hasta, DIAS_FOTO_FIABLE);

  // ── Ventas ──
  const rv = resumenVentas(i.ventas, ctx);
  const ventasMes = i.ventas.filter((v) => enRango(v.fechaISO, rango));
  const porMedioMap = new Map<string, number>();
  for (const v of ventasMes) {
    for (const p of montosPorMedio(v)) {
      porMedioMap.set(p.medio, (porMedioMap.get(p.medio) ?? 0) + p.montoUsd);
    }
  }
  const finanzas = resumenFinanzas(i.ventas, i.movimientos, i.cajas, i.compras, ctx);

  // ── Reparaciones ──
  const rr = resumenReparaciones(
    i.tickets, i.movimientos, i.movimientosCC, i.cajas, i.repuestos, ctx, [],
  );

  // ── Compras (a proveedor: sale plata; los canjes entran como mercadería) ──
  const comprasMes = i.compras.filter((c) => enRango(c.fechaISO, rango));
  const aProveedor = comprasMes.filter((c) => c.origen === "proveedor");
  const proveedores = new Map<string, number>();
  for (const c of aProveedor) {
    const k = c.proveedor || "Sin proveedor";
    proveedores.set(k, (proveedores.get(k) ?? 0) + c.totalUsd);
  }

  // ── Cuenta corriente ──
  const ccMes = i.movimientosCC.filter((m) => enRango(m.fechaISO, rango));

  // ── Patrimonio (foto) ──
  const cotizacionValida = i.cotizacion !== null && Number.isFinite(i.cotizacion) && i.cotizacion > 0;
  const pat = cotizacionValida
    ? armarPatrimonio({
        cotizacion: i.cotizacion as number,
        cajas: i.cajas,
        movimientos: i.movimientos,
        movimientosCC: i.movimientosCC,
        clientes: i.clientes,
        celulares: i.celulares,
        notebooks: i.notebooks,
        repuestos: i.repuestos,
        otros: i.otros,
        compras: i.compras,
        tickets: i.tickets,
      })
    : null;

  // ── Inventario (foto) ──
  const inv = resumenInventario(
    i.celulares, i.repuestos, i.otros, i.movimientosStock, i.ventas, i.tickets, ctx,
  );
  const sumar = (r: Record<string, number>) => Object.values(r).reduce((a, n) => a + n, 0);

  // ── Clientes ──
  const rc = resumenClientes(i.clientes, i.ventas, i.tickets, ctx);
  const nuevos = rc.intel.filter((c) => c.primeraISO && enRango(c.primeraISO, rango)).length;

  // ── Turnos ──
  const rt = resumenTurnos(i.turnos);

  return {
    version: RESUMEN_VERSION,
    periodo: i.periodo,
    rango,
    foto: { al: i.hoy.toISOString(), fiable },
    cotizacion: { valor: cotizacionValida ? (i.cotizacion as number) : null },
    objetivo:
      i.objetivoMesUsd > 0
        ? {
            objetivoUsd: i.objetivoMesUsd,
            cumplidoPct: redondear((rv.facturacion / i.objetivoMesUsd) * 100),
          }
        : null,
    ventas: {
      facturacionUsd: redondear(rv.facturacion),
      operaciones: rv.operaciones,
      ticketPromedioUsd: redondear(rv.ticketPromedio),
      margenPct: rv.margenPct === null ? null : redondear(rv.margenPct),
      gananciaUsd: redondear(finanzas.gananciaVentas),
      deltas: rv.deltas,
      porRubro: rv.rubroTreemap.map((r) => ({ label: r.label, value: redondear(r.value) })),
      porVendedor: rv.porVendedor.map((v) => ({
        label: v.label,
        value: redondear(v.value),
        operaciones: v.operaciones,
      })),
      porMedio: top(
        [...porMedioMap].map(([k, value]) => ({
          label: medioPagoCfg[k as keyof typeof medioPagoCfg]?.label ?? k,
          value: redondear(value),
        })),
        8,
      ),
      porCanal: top(rv.porCanal.map((c) => ({ label: c.label, value: redondear(c.value) })), 6),
    },
    reparaciones: {
      tickets: rr.cantidad,
      cobradoUsd: redondear(rr.cobrado.totalUsd),
      cobradoCajaUsd: redondear(rr.cobrado.cajaUsd),
      cobradoCuentaCorrienteUsd: redondear(rr.cobrado.ccUsd),
      gastoRepuestosUsd: redondear(rr.gastoRepuestos),
      gananciaUsd: redondear(rr.gananciaFinal),
      porFalla: rr.porFalla.slice(0, 5).map((f) => ({ ...f, totalUsd: redondear(f.totalUsd) })),
    },
    compras: {
      totalUsd: redondear(aProveedor.reduce((a, c) => a + c.totalUsd, 0)),
      cantidad: aProveedor.length,
      porProveedor: top([...proveedores].map(([label, value]) => ({ label, value: redondear(value) })), 5),
      canjes: comprasMes.length - aProveedor.length,
    },
    caja: {
      ingresosUsd: redondear(finanzas.ingresosUsd),
      egresosUsd: redondear(finanzas.egresosUsd),
      netoUsd: redondear(finanzas.netoUsd),
      movimientosArsSinCotizacion: finanzas.sinCotizacion.cantidad,
    },
    cuentasCorrientes: {
      cargosUsd: redondear(ccMes.filter((m) => m.tipo === "cargo").reduce((a, m) => a + m.montoUsd, 0)),
      pagosUsd: redondear(ccMes.filter((m) => m.tipo === "pago").reduce((a, m) => a + m.montoUsd, 0)),
      porCobrarUsd: pat ? redondear(pat.activo.creditos.total) : 0,
      saldosAFavorUsd: pat ? redondear(pat.pasivo.saldosAFavor.total) : 0,
    },
    inventario: {
      valorUsd: redondear(inv.valorInventario),
      unidades: inv.unidadesStock,
      inmovilizadoUsd: redondear(inv.inmovilizado),
      porCategoria: Object.entries(inv.stockPorCat).map(([categoria, v]) => ({
        categoria,
        unidades: v.unidades,
        valorUsd: redondear(v.valor),
      })),
      entradas: sumar(inv.entradas),
      salidas: sumar(inv.salidas),
      bajas: inv.bajas,
    },
    clientes: {
      total: rc.kpis.total,
      nuevos,
      activos: rc.kpis.activos,
      enRiesgo: rc.kpis.enRiesgo,
      tasaRecurrenciaPct: redondear(rc.kpis.tasaRecurrencia),
    },
    turnos: {
      total: rt.total,
      confirmados: rt.confirmados,
      cancelados: rt.cancelados,
      pendientes: rt.pendientes,
      porTipo: rt.porTipo,
    },
    patrimonio: pat
      ? {
          activoUsd: redondear(pat.activo.total),
          pasivoUsd: redondear(pat.pasivo.total),
          netoUsd: redondear(pat.patrimonioNeto),
          disponibilidadesUsd: redondear(pat.activo.disponibilidades.total),
          creditosUsd: redondear(pat.activo.creditos.total),
          inventarioUsd: redondear(pat.activo.inventario.total),
          anticiposUsd: redondear(pat.activo.anticipos.total),
        }
      : null,
  };
}
