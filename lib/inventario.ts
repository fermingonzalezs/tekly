import { diasEntre, hoyISO } from "@/lib/date-presets";
import { otroCantidad, otroValorStock } from "@/lib/otros";
import { celularStatus, otroCategoria } from "@/lib/status";
import type {
  Celular,
  CelularStatus,
  Notebook,
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
  itemTipo: "celular" | "notebook" | "repuesto" | "otro";
  itemId: string;
  tipo: string;
  fechaISO: string;
};

/** Orden fijo de los estados de equipo (mismo orden ⇒ mismos colores de la
 *  dona y mismo orden de leyenda en toda la app). */
export const CELULAR_ESTADOS: CelularStatus[] = [
  "en_revision",
  "disponible",
  "reservado",
  "vendido",
  "extraviado",
];

/** Estados con al menos una unidad -- alimenta la dona "Estado de los
 *  celulares". Un estado sin celulares no genera segmento. */
export function celularesPorEstado(celulares: Celular[]): Barra[] {
  return CELULAR_ESTADOS.map((estado) => ({
    label: celularStatus[estado].label,
    value: celulares.filter((e) => e.estado === estado).length,
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

/** Antigüedad del stock de celulares en rangos de días desde el primer
 *  ingreso registrado en `movimientos_stock`. Los ítems vendidos quedan
 *  afuera (no son stock vivo) y los que no tienen ningún ingreso registrado
 *  tampoco: no hay forma honesta de ubicarlos en un rango. */
export function agingCelulares(
  celulares: Celular[],
  movimientos: MovimientoStock[],
  hoy = hoyISO(),
): Barra[] {
  const primerIngreso = new Map<string, string>();
  for (const m of movimientos) {
    if (m.itemTipo !== "celular" || m.tipo !== "ingreso") continue;
    if (!primerIngreso.has(m.itemId)) primerIngreso.set(m.itemId, m.fechaISO);
  }

  const buckets = AGING_RANGOS.map((r) => ({ label: r.label as string, value: 0 }));
  for (const e of celulares) {
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

/** Métricas de la tab Celulares. `valorCosto`/`valorVenta` son sobre TODO el
 *  inventario (histórico, incluye vendidos); `capitalInmovilizado` es el
 *  costo de lo que sigue sin venderse (stock vivo). */
export function resumenCelulares(celulares: Celular[]) {
  const noVendidos = celulares.filter((e) => e.estado !== "vendido");
  return {
    total: celulares.length,
    disponibles: celulares.filter((e) => e.estado === "disponible").length,
    reservados: celulares.filter((e) => e.estado === "reservado").length,
    valorCosto: celulares.reduce((a, e) => a + e.costoUsd, 0),
    valorVenta: celulares.reduce((a, e) => a + e.precioUsd, 0),
    capitalInmovilizado: noVendidos.reduce((a, e) => a + e.costoUsd, 0),
  };
}

/** Orden fijo de los estados de notebook (mismo que celulares). */
export function notebooksPorEstado(notebooks: Notebook[]): Barra[] {
  return CELULAR_ESTADOS.map((estado) => ({
    label: celularStatus[estado].label,
    value: notebooks.filter((n) => n.estado === estado).length,
  })).filter((b) => b.value > 0);
}

/** Métricas de la tab Notebooks. */
export function resumenNotebooks(notebooks: Notebook[]) {
  const noVendidos = notebooks.filter((n) => n.estado !== "vendido");
  return {
    total: notebooks.length,
    disponibles: notebooks.filter((n) => n.estado === "disponible").length,
    reservadas: notebooks.filter((n) => n.estado === "reservado").length,
    valorCosto: notebooks.reduce((a, n) => a + n.costoUsd, 0),
    valorVenta: notebooks.reduce((a, n) => a + n.precioUsd, 0),
    capitalInmovilizado: noVendidos.reduce((a, n) => a + n.costoUsd, 0),
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

// ─────────────────────────── Valor de inventario ───────────────────────────

export type CategoriaInventario = {
  key: "celulares" | "notebooks" | "repuestos" | "otros";
  label: string;
  /** Costo total de la categoría, excluyendo vendidos y extraviados. */
  valor: number;
  unidades: number;
  /** Precio de venta total de lo vendible. `null` en Repuestos (no tienen
   *  precio de venta cargado). */
  valorVenta: number | null;
  /** `valorVenta - valor` cuando hay precio de venta; si no, `null`. */
  margen: number | null;
  /** Unidades cuyo costo no está cargado (0) -- el total es un piso. */
  sinCosto: number;
};

export type ValorInventario = {
  total: number;
  valorVenta: number;
  margenPotencial: number;
  porCategoria: CategoriaInventario[];
  /** Costo de celulares/notebooks en estado «extraviado» -- no es activo,
   *  se muestra como memo (pérdida potencial). */
  extraviadoACosto: number;
};

const CATEGORIAS_INVENTARIO_LABEL: Record<CategoriaInventario["key"], string> = {
  celulares: "Celulares",
  notebooks: "Notebooks",
  repuestos: "Repuestos",
  otros: "Otros",
};

/** Unidades sin costo cargado de una lista de "Otros" (una unidad por serial
 *  o la cantidad, según sea serializado). */
function otrosSinCosto(otros: OtroItem[]): number {
  return otros.reduce((a, o) => {
    if (o.serializado) return a + o.unidades.filter((u) => u.costoUsd <= 0).length;
    return a + (o.costoUsd <= 0 ? o.cantidad : 0);
  }, 0);
}

/** Valor del stock **a costo**, excluyendo vendidos y **extraviados** (un
 *  extraviado no es un activo). Fuente única del "Valor de inventario" y del
 *  Activo del Patrimonio, para que ambos muestren el mismo número. Incluye
 *  `valorVenta`/`margen` como memo. `notebooks` es opcional para no romper a
 *  quien todavía no lo pasa. */
export function valorInventario(input: {
  celulares: Celular[];
  notebooks?: Notebook[];
  repuestos: Repuesto[];
  otros: OtroItem[];
}): ValorInventario {
  const { celulares, notebooks = [], repuestos, otros } = input;
  const vivos = <T extends { estado: CelularStatus }>(xs: T[]) =>
    xs.filter((x) => x.estado !== "vendido" && x.estado !== "extraviado");

  const celVivos = vivos(celulares);
  const nbVivos = vivos(notebooks);

  function categoriaCelular(
    key: "celulares" | "notebooks",
    xs: Celular[] | Notebook[],
  ): CategoriaInventario {
    const valor = xs.reduce((a, e) => a + e.costoUsd, 0);
    const valorVenta = xs.reduce((a, e) => a + e.precioUsd, 0);
    return {
      key,
      label: CATEGORIAS_INVENTARIO_LABEL[key],
      valor,
      unidades: xs.length,
      valorVenta,
      margen: valorVenta - valor,
      sinCosto: xs.filter((e) => e.costoUsd <= 0).length,
    };
  }

  const repuestosValor = repuestos.reduce((a, r) => a + r.stock * r.costoUsd, 0);
  const otrosValor = otros.reduce((a, o) => a + otroValorStock(o), 0);
  const otrosVenta = otros.reduce((a, o) => a + otroCantidad(o) * o.precioUsd, 0);

  const porCategoria: CategoriaInventario[] = [
    categoriaCelular("celulares", celVivos),
    categoriaCelular("notebooks", nbVivos),
    {
      key: "repuestos",
      label: CATEGORIAS_INVENTARIO_LABEL.repuestos,
      valor: repuestosValor,
      unidades: repuestos.reduce((a, r) => a + r.stock, 0),
      valorVenta: null,
      margen: null,
      sinCosto: repuestos
        .filter((r) => r.costoUsd <= 0)
        .reduce((a, r) => a + r.stock, 0),
    },
    {
      key: "otros",
      label: CATEGORIAS_INVENTARIO_LABEL.otros,
      valor: otrosValor,
      unidades: otros.reduce((a, o) => a + otroCantidad(o), 0),
      valorVenta: otrosVenta,
      margen: otrosVenta - otrosValor,
      sinCosto: otrosSinCosto(otros),
    },
  ];

  const total = porCategoria.reduce((a, c) => a + c.valor, 0);
  const valorVenta = porCategoria.reduce((a, c) => a + (c.valorVenta ?? 0), 0);
  const extraviadoACosto =
    celulares
      .filter((e) => e.estado === "extraviado")
      .reduce((a, e) => a + e.costoUsd, 0) +
    notebooks
      .filter((n) => n.estado === "extraviado")
      .reduce((a, n) => a + n.costoUsd, 0);

  return {
    total,
    valorVenta,
    margenPotencial: valorVenta - total,
    porCategoria,
    extraviadoACosto,
  };
}
