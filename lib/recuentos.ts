// Lógica pura de la sección Recuentos (plan 009): agrupaciones para los
// gráficos y conteos para las tarjetas de las dos pestañas (Recuentos /
// Movimientos). Sin Supabase ni React -- testeable con vitest.

import { movimientoTipo } from "@/lib/status";
import type { MovimientoItem, MovimientoTipo, Recuento } from "@/lib/types";

// Orden estable de los tipos de movimiento (el de `movimientoTipo`), para que
// la dona/las series no cambien de orden entre renders.
export const MOVIMIENTO_ORDEN: MovimientoTipo[] = [
  "ingreso",
  "egreso",
  "edicion",
  "baja",
  "recuento",
  "ajuste",
];

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** "2026-09-07T…" -> "2026-09" (clave de mes, sin huso). */
const claveMes = (fechaISO: string) => fechaISO.slice(0, 7);

/** "2026-09" -> "sep 2026". */
function labelMes(clave: string): string {
  const [y, m] = clave.split("-").map(Number);
  return `${MESES_CORTOS[(m ?? 1) - 1]} ${y}`;
}

export type PuntoMes = { label: string; revisados: number; pendientes: number };

/** Recuentos agrupados por mes (`fechaISO`), de más viejo a más nuevo, con
 * `revisados`/`pendientes` por mes -- alimenta las barras agrupadas.
 * Solo entran los meses con al menos un recuento. `maxMeses` recorta a los
 * últimos N (default 6). */
export function recuentosPorMes(recuentos: Recuento[], maxMeses = 6): PuntoMes[] {
  const porMes = new Map<string, PuntoMes>();
  for (const r of recuentos) {
    const clave = claveMes(r.fechaISO);
    if (!clave) continue;
    const punto = porMes.get(clave) ?? {
      label: labelMes(clave),
      revisados: 0,
      pendientes: 0,
    };
    if (r.estado === "pendiente") punto.pendientes += 1;
    else punto.revisados += 1;
    porMes.set(clave, punto);
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(-maxMeses)
    .map(([, punto]) => punto);
}

export type ConteoRecuentos = {
  total: number;
  pendientes: number;
  revisados: number;
  conDiferencias: number;
};

/** Tarjetas de la pestaña Recuentos. "Con diferencias" cuenta los recuentos
 * con al menos una línea (los que hubo que revisar). */
export function conteoRecuentos(recuentos: Recuento[]): ConteoRecuentos {
  const pendientes = recuentos.filter((r) => r.estado === "pendiente").length;
  const conDiferencias = recuentos.filter((r) => r.lineas.length > 0).length;
  return {
    total: recuentos.length,
    pendientes,
    revisados: recuentos.length - pendientes,
    conDiferencias,
  };
}

export type UnidadAjustada = { label: string; value: number };

const TIPO_RECUENTO_LABEL: Record<Recuento["tipo"], string> = {
  equipos: "Equipos",
  repuestos: "Repuestos",
  otros: "Otros",
};

/** Unidades ajustadas por tipo de recuento (Equipos/Repuestos/Otros): solo
 * las diferencias que un admin efectivamente decidió ajustar -- `restaurado`
 * en Equipos (vuelve a `disponible`) y `ajustado` en Repuestos/Otros (el
 * stock pasa a lo contado). `descartado` no cambia nada y `confirmado`
 * (equipo que sigue extraviado) tampoco toca una cantidad, así que no
 * suman. Para un equipo, cada línea restaurada vale 1; para repuestos/otros,
 * la magnitud de la diferencia (`|contado - sistema|`). */
export function unidadesAjustadasPorTipo(recuentos: Recuento[]): UnidadAjustada[] {
  const acumulado: Record<Recuento["tipo"], number> = {
    equipos: 0,
    repuestos: 0,
    otros: 0,
  };
  for (const r of recuentos) {
    for (const linea of r.lineas) {
      if (r.tipo === "equipos") {
        if (linea.resolucion === "restaurado") acumulado.equipos += 1;
      } else if (linea.resolucion === "ajustado") {
        const l = linea as {
          cantidadSistema: number;
          cantidadContada: number;
        };
        acumulado[r.tipo] += Math.abs(l.cantidadContada - l.cantidadSistema);
      }
    }
  }
  return (Object.keys(acumulado) as Recuento["tipo"][]).map((t) => ({
    label: TIPO_RECUENTO_LABEL[t],
    value: acumulado[t],
  }));
}

export type PuntoDia = { label: string; value: number };

/** Movimientos agrupados por día (`fechaISO`), de más viejo a más nuevo.
 * `maxDias` recorta a los últimos N (default 14). Label "dd/mm". */
export function movimientosPorDia(
  movimientos: MovimientoItem[],
  maxDias = 14,
): PuntoDia[] {
  const porDia = new Map<string, PuntoDia>();
  for (const m of movimientos) {
    const dia = m.fechaISO.slice(0, 10);
    if (!dia) continue;
    const punto = porDia.get(dia) ?? {
      label: `${dia.slice(8, 10)}/${dia.slice(5, 7)}`,
      value: 0,
    };
    punto.value += 1;
    porDia.set(dia, punto);
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(-maxDias)
    .map(([, punto]) => punto);
}

export type ConteoMovimientos = {
  total: number;
  ingresos: number;
  egresos: number;
  ajustes: number;
};

/** Tarjetas de la pestaña Movimientos. "Ajustes" agrupa `ajuste` +
 * `recuento` (un recuento es, en la práctica, un ajuste de stock) -- el
 * resto de los tipos (`edicion`, `baja`) solo se ven en el desglose. */
export function conteoMovimientos(
  movimientos: MovimientoItem[],
): ConteoMovimientos {
  let ingresos = 0;
  let egresos = 0;
  let ajustes = 0;
  for (const m of movimientos) {
    if (m.tipo === "ingreso") ingresos += 1;
    else if (m.tipo === "egreso") egresos += 1;
    else if (m.tipo === "ajuste" || m.tipo === "recuento") ajustes += 1;
  }
  return { total: movimientos.length, ingresos, egresos, ajustes };
}

export type TipoConteo = { label: string; value: number };

/** Movimientos por tipo, en el orden estable de `MOVIMIENTO_ORDEN`; solo los
 * tipos con al menos un movimiento. Alimenta la dona "Por tipo". */
export function movimientosPorTipo(
  movimientos: MovimientoItem[],
): TipoConteo[] {
  const porTipo = new Map<MovimientoTipo, number>();
  for (const m of movimientos) {
    porTipo.set(m.tipo, (porTipo.get(m.tipo) ?? 0) + 1);
  }
  return MOVIMIENTO_ORDEN.filter((t) => (porTipo.get(t) ?? 0) > 0).map((t) => ({
    label: movimientoTipo[t].label,
    value: porTipo.get(t) ?? 0,
  }));
}
