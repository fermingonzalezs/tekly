import type {
  Caja,
  Conciliacion,
  ConciliacionLinea,
  MedioPago,
  MovimientoCaja,
} from "@/lib/types";
import { movimientoEnUsd } from "@/lib/analiticas";

/** Lógica pura de cajas/conciliación -- sin Supabase, testeable sin red.
 * `lib/db/cajas.ts` es quien trae los movimientos de la base y le pasa el
 * resultado a estas funciones. La UI (gráficos, tarjetas) también calcula
 * acá en vez de reimplementar los agregados inline. */

export type Moneda = "usd" | "ars";

export type MovimientoSigno = { tipo: "ingreso" | "egreso"; monto: number };

/** Monto con signo: ingreso suma, egreso resta. */
export function signo(m: MovimientoSigno): number {
  return m.tipo === "ingreso" ? m.monto : -m.monto;
}

/** Neto de una lista de movimientos -- lo que el sistema espera encontrar
 * en la caja contando todos ellos (típicamente: movimientos desde la
 * última conciliación, ya filtrados por caja en `lib/db/cajas.ts`). */
export function netoMovimientos(movimientos: MovimientoSigno[]): number {
  return movimientos.reduce((acc, m) => acc + signo(m), 0);
}

export type PagoConCaja = { medio: MedioPago; montoUsd: number; caja: "usd" | "ars" };

/** Convierte un monto de una caja a ARS -- usd * cotización, ars igual. */
export function enArs(montoCaja: number, moneda: "usd" | "ars", cotizacion: number): number {
  return moneda === "ars" ? montoCaja : montoCaja * cotizacion;
}

// ───────────────────────── Saldos y totales ─────────────────────────

/** Saldo (neto) de una caja en SU PROPIA moneda: los movimientos ya están
 * en la moneda de la caja, no hace falta convertir nada. */
export type SaldoCaja = {
  cajaId: string;
  nombre: string;
  moneda: Moneda;
  /** Neto con signo en la moneda de la caja. */
  saldo: number;
  /** Cantidad de movimientos contados (incluye los no convertibles). */
  movimientos: number;
};

function cajasPorId(cajas: Caja[]): Map<string, Caja> {
  return new Map(cajas.map((c) => [c.id, c]));
}

/** Neto por caja en la moneda de cada caja. Solo incluye cajas con al menos
 * un movimiento en la lista recibida. */
export function saldoPorCaja(movs: MovimientoCaja[], cajas: Caja[]): SaldoCaja[] {
  const porId = cajasPorId(cajas);
  const acc = new Map<string, SaldoCaja>();
  for (const m of movs) {
    const caja = porId.get(m.cajaId);
    if (!caja) continue;
    const fila =
      acc.get(caja.id) ??
      { cajaId: caja.id, nombre: caja.nombre, moneda: caja.moneda, saldo: 0, movimientos: 0 };
    fila.saldo += signo(m);
    fila.movimientos += 1;
    acc.set(caja.id, fila);
  }
  return [...acc.values()];
}

export type TotalPorMoneda = { ars: number; usd: number };

/** Suma de saldos por moneda (sin convertir: cada caja en la suya). */
export function totalPorMoneda(movs: MovimientoCaja[], cajas: Caja[]): TotalPorMoneda {
  const out: TotalPorMoneda = { ars: 0, usd: 0 };
  for (const c of saldoPorCaja(movs, cajas)) {
    if (c.moneda === "ars") out.ars += c.saldo;
    else out.usd += c.saldo;
  }
  return out;
}

export type TotalMedio = { medio: MedioPago; totalUsd: number };

/** Total por medio de pago consolidado en USD: caja USD tal cual, caja ARS
 * con la cotización GUARDADA de cada movimiento (nunca el blue de hoy), y
 * los movimientos en pesos sin cotización quedan afuera -- mismo criterio
 * que `movimientoEnUsd` de Analíticas. */
export function totalPorMedio(movs: MovimientoCaja[], cajas: Caja[], medio: MedioPago): number {
  const porId = cajasPorId(cajas);
  let total = 0;
  for (const m of movs) {
    if (m.medioPago !== medio) continue;
    const caja = porId.get(m.cajaId);
    if (!caja) continue;
    const usd = movimientoEnUsd(m, caja);
    if (usd === null) continue;
    total += m.tipo === "ingreso" ? usd : -usd;
  }
  return total;
}

export type DiaIngresosEgresos = { fecha: string; ingresos: number; egresos: number };

/** Ingresos vs egresos por día en USD (`fechaISO` asc). Los movimientos en
 * pesos sin cotización guardada no entran. */
export function ingresosEgresosPorDia(
  movs: MovimientoCaja[],
  cajas: Caja[],
): DiaIngresosEgresos[] {
  const porId = cajasPorId(cajas);
  const acc = new Map<string, DiaIngresosEgresos>();
  for (const m of movs) {
    const caja = porId.get(m.cajaId);
    if (!caja) continue;
    const usd = movimientoEnUsd(m, caja);
    if (usd === null) continue;
    const fila = acc.get(m.fechaISO) ?? { fecha: m.fechaISO, ingresos: 0, egresos: 0 };
    if (m.tipo === "ingreso") fila.ingresos += usd;
    else fila.egresos += usd;
    acc.set(m.fechaISO, fila);
  }
  return [...acc.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ───────────────────────── Conciliaciones ─────────────────────────

/** Diferencia de una línea: lo contado menos lo que el sistema esperaba
 * (positivo = sobró, negativo = faltó). En la moneda de la caja. */
export function diferenciaDeLinea(l: ConciliacionLinea): number {
  return l.montoReal - l.montoSistema;
}

export type ResumenConciliaciones = {
  total: number;
  /** Conciliaciones con al menos una línea descuadrada. */
  conDiferencia: number;
  /** Suma con signo de las diferencias de cajas ARS / cajas USD -- se
   * informan por separado porque no hay cotización guardada en la línea
   * que permita unificarlas. */
  diferenciaArs: number;
  diferenciaUsd: number;
  /** "07 sep · 14:30" de la más reciente, `null` si no hay ninguna. */
  ultima: string | null;
};

export function resumenConciliaciones(
  conciliaciones: Conciliacion[],
  cajas: Caja[],
): ResumenConciliaciones {
  const porId = cajasPorId(cajas);
  const out: ResumenConciliaciones = {
    total: conciliaciones.length,
    conDiferencia: 0,
    diferenciaArs: 0,
    diferenciaUsd: 0,
    ultima: conciliaciones[0]
      ? `${conciliaciones[0].fecha} · ${conciliaciones[0].hora}`
      : null,
  };
  for (const c of conciliaciones) {
    let tiene = false;
    for (const l of c.lineas) {
      const diff = diferenciaDeLinea(l);
      if (diff === 0) continue;
      tiene = true;
      if (porId.get(l.cajaId)?.moneda === "usd") out.diferenciaUsd += diff;
      else out.diferenciaArs += diff;
    }
    if (tiene) out.conDiferencia += 1;
  }
  return out;
}

export type DiferenciaConciliacion = {
  id: string;
  label: string;
  /** Cajas que sobraron / faltaron (para barras +/− sin mezclar monedas). */
  sobrantes: number;
  faltantes: number;
  cajasConDiferencia: number;
};

/** Por conciliación: cuántas cajas sobraron y cuántas faltaron. Es un
 * conteo libre de moneda -- la plata de cada caja se ve en la tabla y en
 * el ranking por caja (`diferenciaPorCaja`). */
export function diferenciaPorConciliacion(
  conciliaciones: Conciliacion[],
  cajas: Caja[],
): DiferenciaConciliacion[] {
  const porId = cajasPorId(cajas);
  return conciliaciones
    .map((c) => {
      let sobrantes = 0;
      let faltantes = 0;
      for (const l of c.lineas) {
        if (!porId.has(l.cajaId)) continue;
        const diff = diferenciaDeLinea(l);
        if (diff > 0) sobrantes += 1;
        else if (diff < 0) faltantes += 1;
      }
      return {
        id: c.id,
        label: c.fecha,
        sobrantes,
        faltantes,
        cajasConDiferencia: sobrantes + faltantes,
      };
    })
    .reverse(); // cronológico (el listado llega del más nuevo al más viejo)
}

export type DiferenciaCaja = {
  cajaId: string;
  nombre: string;
  moneda: Moneda;
  /** Diferencia acumulada con signo, en la moneda de la caja. */
  diff: number;
  /** Conciliaciones en las que esta caja quedó descuadrada. */
  conciliaciones: number;
};

/** Diferencia acumulada por caja, en la moneda de la caja. */
export function diferenciaPorCaja(
  conciliaciones: Conciliacion[],
  cajas: Caja[],
): DiferenciaCaja[] {
  const porId = cajasPorId(cajas);
  const acc = new Map<string, DiferenciaCaja>();
  for (const c of conciliaciones) {
    for (const l of c.lineas) {
      const caja = porId.get(l.cajaId);
      if (!caja) continue;
      const fila =
        acc.get(caja.id) ??
        { cajaId: caja.id, nombre: caja.nombre, moneda: caja.moneda, diff: 0, conciliaciones: 0 };
      const diff = diferenciaDeLinea(l);
      if (diff !== 0) {
        fila.diff += diff;
        fila.conciliaciones += 1;
      }
      acc.set(caja.id, fila);
    }
  }
  return [...acc.values()].filter((d) => d.conciliaciones > 0);
}
