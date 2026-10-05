import { diasEntre, hoyISO } from "@/lib/date-presets";
import { otroCantidad, otroValorStock } from "@/lib/otros";
import { equipoStatus, otroCategoria } from "@/lib/status";
import type {
  Equipo,
  EquipoStatus,
  OtroCategoria,
  OtroItem,
  Repuesto,
} from "@/lib/types";

/** Fila de un gráfico de barras (`GraficoRanking`/`GraficoDona`). */
export type Barra = { label: string; value: number };

/** Forma mínima de un `movimientos_stock` que necesita el aging -- no
 *  importamos `MovimientoStockBulk` de `lib/db/inventario` para que este
 *  módulo siga siendo puro (sin `server-only` ni Supabase). */
export type MovimientoStock = {
  itemTipo: "equipo" | "repuesto" | "otro";
  itemId: string;
  tipo: string;
  fechaISO: string;
};

/** Orden fijo de los estados de equipo (mismo orden ⇒ mismos colores de la
 *  dona y mismo orden de leyenda en toda la app). */
export const EQUIPO_ESTADOS: EquipoStatus[] = [
  "en_revision",
  "disponible",
  "reservado",
  "vendido",
  "extraviado",
];

/** Estados con al menos una unidad -- alimenta la dona "Estado de los
 *  equipos". Un estado sin equipos no genera segmento. */
export function equiposPorEstado(equipos: Equipo[]): Barra[] {
  return EQUIPO_ESTADOS.map((estado) => ({
    label: equipoStatus[estado].label,
    value: equipos.filter((e) => e.estado === estado).length,
  })).filter((b) => b.value > 0);
}

/** Rangos de antigüedad y su tope en días (`180+` = infinito). */
const AGING_RANGOS = [
  { label: "0-30", max: 30 },
  { label: "31-60", max: 60 },
  { label: "61-90", max: 90 },
  { label: "91-180", max: 180 },
  { label: "180+", max: Number.POSITIVE_INFINITY },
] as const;

/** Antigüedad del stock de equipos en rangos de días desde el primer
 *  ingreso registrado en `movimientos_stock`. Los ítems vendidos quedan
 *  afuera (no son stock vivo) y los que no tienen ningún ingreso registrado
 *  tampoco: no hay forma honesta de ubicarlos en un rango. */
export function agingEquipos(
  equipos: Equipo[],
  movimientos: MovimientoStock[],
  hoy = hoyISO(),
): Barra[] {
  const primerIngreso = new Map<string, string>();
  for (const m of movimientos) {
    if (m.itemTipo !== "equipo" || m.tipo !== "ingreso") continue;
    if (!primerIngreso.has(m.itemId)) primerIngreso.set(m.itemId, m.fechaISO);
  }

  const buckets = AGING_RANGOS.map((r) => ({ label: r.label as string, value: 0 }));
  for (const e of equipos) {
    if (e.estado === "vendido") continue;
    const fecha = primerIngreso.get(e.id);
    if (!fecha) continue;
    const dias = diasEntre(fecha, hoy);
    if (dias < 0) continue;
    const i = AGING_RANGOS.findIndex((r) => dias <= r.max);
    if (i < 0) continue; // defensivo: "180+" siempre atrapa
    buckets[i].value += 1;
  }
  return buckets.filter((b) => b.value > 0);
}

/** Stock actual de cada repuesto contra su mínimo (ranking). Ordenado por
 *  urgencia (stock/mínimo más bajo primero) y acotado para que no desborde
 *  la card de altura fija. El mínimo va en el label. */
export function stockVsMinimo(repuestos: Repuesto[], limite = 8): Barra[] {
  return repuestos
    .filter((r) => r.stockMin > 0)
    .map((r) => ({
      label: `${r.nombre} · mín ${r.stockMin}`,
      value: r.stock,
      ratio: r.stock / r.stockMin,
    }))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, limite)
    .map(({ label, value }) => ({ label, value }));
}

/** Valor a costo del stock agrupado por proveedor (ranking descendente). */
export function valorPorProveedor(repuestos: Repuesto[], limite = 8): Barra[] {
  const porProveedor = new Map<string, number>();
  for (const r of repuestos) {
    const proveedor = r.proveedor && r.proveedor !== "—" ? r.proveedor : "Sin proveedor";
    porProveedor.set(
      proveedor,
      (porProveedor.get(proveedor) ?? 0) + r.stock * r.costoUsd,
    );
  }
  return [...porProveedor.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limite);
}

/** Orden fijo de las categorías de "Otros" (mismo orden ⇒ mismos colores). */
export const OTRO_CATEGORIAS: OtroCategoria[] = [
  "ipad",
  "airpods",
  "tablet",
  "accesorio",
  "otro",
];

/** Unidades en stock por categoría de "Otros" -- alimenta la dona. Una
 *  categoría sin unidades no genera segmento. */
export function unidadesPorCategoria(otros: OtroItem[]): Barra[] {
  return OTRO_CATEGORIAS.map((categoria) => ({
    label: otroCategoria[categoria].label,
    value: otros
      .filter((o) => o.categoria === categoria)
      .reduce((a, o) => a + otroCantidad(o), 0),
  })).filter((b) => b.value > 0);
}

/** Valor a costo por categoría de "Otros" (ranking descendente). */
export function valorPorCategoria(otros: OtroItem[], limite = 8): Barra[] {
  return OTRO_CATEGORIAS.map((categoria) => ({
    label: otroCategoria[categoria].label,
    value: otros
      .filter((o) => o.categoria === categoria)
      .reduce((a, o) => a + otroValorStock(o), 0),
  }))
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limite);
}

/** Métricas de la tab Equipos. `valorCosto`/`valorVenta` son sobre TODO el
 *  inventario (histórico, incluye vendidos); `capitalInmovilizado` es el
 *  costo de lo que sigue sin venderse (stock vivo). */
export function resumenEquipos(equipos: Equipo[]) {
  const noVendidos = equipos.filter((e) => e.estado !== "vendido");
  return {
    total: equipos.length,
    disponibles: equipos.filter((e) => e.estado === "disponible").length,
    reservados: equipos.filter((e) => e.estado === "reservado").length,
    valorCosto: equipos.reduce((a, e) => a + e.costoUsd, 0),
    valorVenta: equipos.reduce((a, e) => a + e.precioUsd, 0),
    capitalInmovilizado: noVendidos.reduce((a, e) => a + e.costoUsd, 0),
  };
}

/** Métricas de la tab Repuestos. */
export function resumenRepuestos(repuestos: Repuesto[]) {
  return {
    total: repuestos.length,
    unidades: repuestos.reduce((a, r) => a + r.stock, 0),
    valor: repuestos.reduce((a, r) => a + r.stock * r.costoUsd, 0),
    bajoMinimo: repuestos.filter((r) => r.stock > 0 && r.stock <= r.stockMin).length,
    sinStock: repuestos.filter((r) => r.stock <= 0).length,
  };
}

/** Métricas de la tab Otros. No hay "bajo mínimo" (el tipo `OtroItem` no
 *  tiene `stockMin`): se usa el conteo de serializados en su lugar. */
export function resumenOtros(otros: OtroItem[]) {
  return {
    total: otros.length,
    unidades: otros.reduce((a, o) => a + otroCantidad(o), 0),
    valor: otros.reduce((a, o) => a + otroValorStock(o), 0),
    valorVenta: otros.reduce((a, o) => a + otroCantidad(o) * o.precioUsd, 0),
    serializados: otros.filter((o) => o.serializado).length,
  };
}
