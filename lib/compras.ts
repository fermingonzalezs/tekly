// Cálculos puros de la sección Compras (plan 009): gráficos y tarjetas que
// se derivan de la lista filtrada en el cliente. Sin Supabase, sin React --
// testeable con `lib/compras.test.ts`. El único campo de fecha que sirve
// para agrupar es `Compra.fechaISO` ("2026-09-07"), igual que en el resto
// de la app (la `fecha` display no trae año).

import type { Compra } from "@/lib/types";

export type CompraMesRow = { label: string; value: number };
export type CompraProveedorRow = { label: string; value: number };

/** Cuántos proveedores entran en el ranking "Gasto por proveedor". */
export const TOP_PROVEEDORES = 8;

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Clave de agrupación por mes "YYYY-MM" a partir de una fecha ISO. */
export function mesDe(fechaISO: string): string {
  return fechaISO.slice(0, 7);
}

/** "2026-09-07" → "sep 26" (etiqueta corta del eje X del gráfico por mes). */
export function etiquetaMes(mesYYYYMM: string): string {
  const [y, m] = mesYYYYMM.split("-");
  const idx = Number(m) - 1;
  const nombre = MESES_CORTOS[idx] ?? "?";
  return `${nombre} ${y.slice(2)}`;
}

/**
 * Gasto por mes sobre TODA la lista recibida (ya filtrada por la sección),
 * de más viejo a más nuevo, incluyendo los meses sin compras (valor 0) para
 * que las barras no salten períodos. Lista vacía → `[]` (empty state).
 */
export function gastoPorMes(compras: Compra[]): CompraMesRow[] {
  if (compras.length === 0) return [];
  const totales = new Map<string, number>();
  for (const c of compras) {
    const mes = mesDe(c.fechaISO);
    totales.set(mes, (totales.get(mes) ?? 0) + c.totalUsd);
  }
  const meses = [...totales.keys()].sort();
  const rows: CompraMesRow[] = [];
  const [primerY, primerM] = meses[0].split("-").map(Number);
  const [ultimoY, ultimoM] = meses[meses.length - 1].split("-").map(Number);
  let y = primerY;
  let m = primerM;
  while (y < ultimoY || (y === ultimoY && m <= ultimoM)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    rows.push({ label: etiquetaMes(key), value: totales.get(key) ?? 0 });
    if (m === 12) {
      m = 1;
      y += 1;
    } else {
      m += 1;
    }
  }
  return rows;
}

/**
 * Gasto por proveedor (o cliente, en compras de canje) sobre TODA la lista
 * recibida, ordenado de mayor a menor y recortado a `top`. La contraparte
 * sin nombre cae a "Sin proveedor" para no perder el gasto en el ranking.
 */
export function gastoPorProveedor(
  compras: Compra[],
  top: number = TOP_PROVEEDORES,
): CompraProveedorRow[] {
  const totales = new Map<string, number>();
  for (const c of compras) {
    const nombre = (c.origen === "canje" ? c.cliente : c.proveedor)?.trim() || "Sin proveedor";
    totales.set(nombre, (totales.get(nombre) ?? 0) + c.totalUsd);
  }
  return [...totales.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

export type ResumenCompras = {
  cantidad: number;
  gastadoUsd: number;
  pendientes: number;
  recibidas: number;
  ticketPromedioUsd: number;
};

/** Métricas de las 4 `StatCard` de Compras sobre la lista filtrada. */
export function resumenCompras(compras: Compra[]): ResumenCompras {
  const gastadoUsd = compras.reduce((a, c) => a + c.totalUsd, 0);
  return {
    cantidad: compras.length,
    gastadoUsd,
    pendientes: compras.filter((c) => c.estado === "pendiente").length,
    recibidas: compras.filter((c) => c.estado === "recibida").length,
    ticketPromedioUsd: compras.length ? gastadoUsd / compras.length : 0,
  };
}
