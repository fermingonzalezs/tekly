import type { Venta } from "@/lib/types";
import { RUBRO_LABEL, RUBRO_ORDEN, categoriaDe, type Rubro } from "@/lib/ventas";

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]; // orden de Date#getDay()

function claveDia(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Facturación real por mes, últimos `meses` meses (incluye el actual).
 * Meses sin ventas salen en 0 -- no se saltean, para que el gráfico de
 * barras siempre tenga el mismo ancho.
 *
 * `fechaISO` es siempre "YYYY-MM-DD": lo leemos con slice, nunca con
 * `new Date(iso)` -- ese constructor parsea como UTC medianoche, y leerlo
 * después con `.getMonth()` (hora local) corre la fecha un día para atrás
 * en cualquier huso horario negativo (Argentina incluida). */
export function ventasPorMes(
  ventas: Venta[],
  meses = 6,
  hoy = new Date(),
): { mes: string; usd: number }[] {
  const totales = new Map<string, number>();
  for (const v of ventas) {
    const clave = v.fechaISO.slice(0, 7); // "YYYY-MM"
    totales.set(clave, (totales.get(clave) ?? 0) + v.totalUsd);
  }
  const out: { mes: string; usd: number }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ mes: MESES[d.getMonth()], usd: totales.get(clave) ?? 0 });
  }
  return out;
}

/** Facturación real por día, últimos `dias` días (incluye hoy) -- para el
 * gráfico de "facturación acumulada". Mismo cuidado que `ventasPorMes`:
 * las claves de día se arman con aritmética local, nunca `.toISOString()`
 * (esa sí vuelve a UTC y puede correr un día en husos positivos). */
export function facturacionDiaria(ventas: Venta[], dias = 14, hoy = new Date()): number[] {
  const totales = new Map<string, number>();
  for (const v of ventas) {
    totales.set(v.fechaISO.slice(0, 10), (totales.get(v.fechaISO.slice(0, 10)) ?? 0) + v.totalUsd);
  }
  const out: number[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    out.push(totales.get(claveDia(d.getFullYear(), d.getMonth(), d.getDate())) ?? 0);
  }
  return out;
}

export type RubroMes = { mes: string } & Record<Rubro, number>;

/** Facturación real por mes y por rubro, últimos `meses` meses (incluye el
 * actual) -- mismo `categoriaDe` que `margenPorTipo`/`ventasPorRubro`
 * (dashboard), una sola fuente de verdad para qué es cada rubro. Alimenta
 * `TendenciaRubros`. Mismo cuidado de husos horarios que `ventasPorMes`
 * (`fechaISO` se lee con `.slice()`, nunca con `new Date(iso)`). */
export function ventasPorRubroMes(
  ventas: Venta[],
  meses = 6,
  hoy = new Date(),
): RubroMes[] {
  const vacio = (): Record<Rubro, number> => ({ equipo: 0, servicio: 0, otro: 0, libre: 0 });
  const totales = new Map<string, Record<Rubro, number>>();
  for (const v of ventas) {
    const clave = v.fechaISO.slice(0, 7); // "YYYY-MM"
    const acc = totales.get(clave) ?? vacio();
    for (const item of v.items) {
      const cat = categoriaDe(item);
      acc[cat] += item.precioUsd * item.cantidad;
    }
    totales.set(clave, acc);
  }
  const out: RubroMes[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ mes: MESES[d.getMonth()], ...(totales.get(clave) ?? vacio()) });
  }
  return out;
}

export type VentaDia = { dia: string; usd: number; operaciones: number };

/** Facturación real por día de la semana (Lun a Dom), sobre el conjunto de
 * ventas que se le pase (respeta el filtro de fecha de la pestaña Ventas
 * si se lo llama con `ventasFiltradas`). `fechaISO` se arma en `Date(y, m-1,
 * d)` -- construcción local a propósito, nunca `new Date(iso).getDay()`
 * (ese constructor parsea la fecha como UTC medianoche, y `getDay()` la lee
 * en hora local -- mismo bug de huso horario que ya nos mordió en
 * `ventasPorMes`/`facturacionDiaria`). */
export function ventasPorDiaSemana(ventas: Venta[]): VentaDia[] {
  const totales = Array.from({ length: 7 }, () => ({ usd: 0, operaciones: 0 }));
  for (const v of ventas) {
    const [y, m, d] = v.fechaISO.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    totales[dow].usd += v.totalUsd;
    totales[dow].operaciones += 1;
  }
  const orden = [1, 2, 3, 4, 5, 6, 0]; // Lun..Dom
  return orden.map((i) => ({
    dia: DIAS_SEMANA[i],
    usd: Math.round(totales[i].usd),
    operaciones: totales[i].operaciones,
  }));
}

export type MargenPorTipo = {
  tipo: string;
  operaciones: number;
  margenPct: number;
  gananciaUsd: number;
};

/** Margen real por rubro (mismo `categoriaDe` que `ventasPorRubro` del
 * dashboard -- una sola fuente de verdad), todo el historial de ventas.
 * `VentaItem.costoUsd` es opcional: un ítem sin costo cargado no entra en
 * el cálculo de margen (ni en ingreso ni en ganancia), pero sí cuenta como
 * operación -- así un rubro con costos sin cargar no queda con margen 0
 * artificial, muestra el margen real de lo que sí tiene costo. */
export function margenPorTipo(ventas: Venta[]): MargenPorTipo[] {
  const operaciones = new Map<string, number>();
  const ingreso = new Map<string, number>();
  const ganancia = new Map<string, number>();

  for (const v of ventas) {
    for (const item of v.items) {
      const cat = categoriaDe(item);
      operaciones.set(cat, (operaciones.get(cat) ?? 0) + 1);
      if (item.costoUsd === undefined) continue;
      ingreso.set(cat, (ingreso.get(cat) ?? 0) + item.precioUsd * item.cantidad);
      ganancia.set(
        cat,
        (ganancia.get(cat) ?? 0) + (item.precioUsd - item.costoUsd) * item.cantidad,
      );
    }
  }

  return RUBRO_ORDEN.map((cat) => {
    const ing = ingreso.get(cat) ?? 0;
    const gan = ganancia.get(cat) ?? 0;
    return {
      tipo: RUBRO_LABEL[cat],
      operaciones: operaciones.get(cat) ?? 0,
      margenPct: ing > 0 ? Math.round((gan / ing) * 1000) / 10 : 0,
      gananciaUsd: Math.round(gan),
    };
  });
}
