// Cálculos puros de la sección Compras (plan 009): gráficos y tarjetas que
// se derivan de la lista filtrada en el cliente. Sin Supabase, sin React --
// testeable con `lib/compras.test.ts`. El único campo de fecha que sirve
// para agrupar es `Compra.fechaISO` ("2026-09-07"), igual que en el resto
// de la app (la `fecha` display no trae año).

import type { CelularInput } from "@/lib/db/inventario";
import type { NotebookInput } from "@/lib/notebooks";
import type { Compra, CompraItem, OtroCategoria, OtroUnidad } from "@/lib/types";

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
    const nombre =
      (c.proveedor || (c.origen === "canje" ? c.cliente : ""))?.trim() || "Sin proveedor";
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

// ───────────────────── Compras que suben al stock (plan 025) ─────────────────────


/** Ítem del carrito de una compra que sube al stock. `costoUsd` es el costo
 * **unitario** antes del prorrateo de los costos adicionales; `cantidad` es
 * 1 para celulares y notebooks (una fila = una unidad). */
export type ItemCompraStock =
  | { tipo: "celular"; detalle: string; cantidad: 1; costoUsd: number; celular: CelularInput }
  | { tipo: "notebook"; detalle: string; cantidad: 1; costoUsd: number; notebook: NotebookInput }
  | {
      tipo: "repuesto";
      detalle: string;
      cantidad: number;
      costoUsd: number;
      /** Repuesto existente al que se suma stock; sin él se crea `nombre`. */
      repuestoId?: string;
      nombre?: string;
    }
  | {
      tipo: "otro";
      detalle: string;
      cantidad: number;
      costoUsd: number;
      otroId?: string;
      nuevo?: { nombre: string; categoria: OtroCategoria; precioVenta: number };
      /** Productos serializados: una unidad por serial, cada una con su costo. */
      unidades?: OtroUnidad[];
    };

export type TipoItemCompra = ItemCompraStock["tipo"];

export const TIPO_ITEM_COMPRA_LABEL: Record<TipoItemCompra, string> = {
  celular: "Celular",
  notebook: "Notebook",
  repuesto: "Repuesto",
  otro: "Otro",
};

const centavos = (n: number) => Math.round(n * 100);

/**
 * Reparte `adicionalUsd` (envío, flete, comisiones) entre las líneas en
 * proporción a su subtotal (`cantidad × costoUsd`). Devuelve el adicional de
 * cada **línea** (no por unidad), en centavos exactos: la diferencia de
 * redondeo va a la línea más cara, así la suma da justo `adicionalUsd`.
 * Si todas las líneas valen 0, reparte por cantidad de unidades.
 */
export function prorratearCostos(
  lineas: { cantidad: number; costoUsd: number }[],
  adicionalUsd: number,
): number[] {
  const total = centavos(Math.max(0, adicionalUsd));
  if (lineas.length === 0 || total === 0) return lineas.map(() => 0);
  const pesos = lineas.map((l) => Math.max(0, l.cantidad * l.costoUsd));
  const sumaPesos = pesos.reduce((a, p) => a + p, 0);
  const base = sumaPesos > 0 ? pesos : lineas.map((l) => Math.max(0, l.cantidad));
  const sumaBase = base.reduce((a, p) => a + p, 0) || 1;
  const partes = base.map((p) => Math.floor((total * p) / sumaBase));
  const resto = total - partes.reduce((a, p) => a + p, 0);
  const mayor = base.indexOf(Math.max(...base));
  partes[mayor] += resto;
  return partes.map((c) => c / 100);
}

/** Costo unitario final (con su parte de los adicionales), redondeado a centavos. */
export function costoFinalUnitario(
  item: { cantidad: number; costoUsd: number },
  adicionalLinea: number,
): number {
  const cantidad = Math.max(1, item.cantidad);
  return Math.round((item.costoUsd + adicionalLinea / cantidad) * 100) / 100;
}

export type ResumenCompraStock = { subtotalUsd: number; adicionalUsd: number; totalUsd: number };

export function resumenCompraStock(
  items: { cantidad: number; costoUsd: number }[],
  adicionalUsd: number,
): ResumenCompraStock {
  const subtotal = centavos(items.reduce((a, i) => a + i.cantidad * i.costoUsd, 0));
  const adicional = centavos(Math.max(0, adicionalUsd));
  return {
    subtotalUsd: subtotal / 100,
    adicionalUsd: adicional / 100,
    totalUsd: (subtotal + adicional) / 100,
  };
}

/** Snapshot que se guarda en `compras.items` (jsonb que leen Analíticas,
 * resúmenes y el detalle): costo unitario ya prorrateado. */
export function snapshotItems(items: ItemCompraStock[], adicionalUsd: number): CompraItem[] {
  const adicionales = prorratearCostos(items, adicionalUsd);
  return items.map((it, i) => ({
    detalle: it.detalle,
    cantidad: it.cantidad,
    costoUsd: costoFinalUnitario(it, adicionales[i]),
  }));
}

/** IMEI o número de serie de un ítem (`""` si no tiene). */
export function serieDeItem(item: ItemCompraStock): string {
  if (item.tipo === "celular") {
    const imei = item.celular.imei.trim();
    return imei === "—" ? "" : imei;
  }
  if (item.tipo === "notebook") return item.notebook.numeroSerie.trim();
  return "";
}

/**
 * Errores que impiden guardar una compra que sube al stock (vacío = OK).
 * `seriesExistentes` son IMEIs/series ya cargados en la organización.
 */
export function erroresCompraStock(
  items: ItemCompraStock[],
  seriesExistentes: Iterable<string> = [],
): string[] {
  const errores: string[] = [];
  if (items.length === 0) errores.push("Agregá al menos un producto a la compra.");
  const existentes = new Set([...seriesExistentes].map((s) => s.trim().toUpperCase()));
  const vistas = new Set<string>();
  items.forEach((it, i) => {
    const n = `Ítem ${i + 1} (${it.detalle || TIPO_ITEM_COMPRA_LABEL[it.tipo]})`;
    if (!(it.cantidad >= 1) || !Number.isInteger(it.cantidad)) {
      errores.push(`${n}: la cantidad tiene que ser un entero mayor a 0.`);
    }
    if (!(it.costoUsd >= 0)) errores.push(`${n}: el costo no puede ser negativo.`);
    if (it.tipo === "celular" && !it.celular.varianteId) errores.push(`${n}: elegí la variante.`);
    if (it.tipo === "notebook" && !it.notebook.varianteId) errores.push(`${n}: elegí la variante.`);
    if (it.tipo === "repuesto" && !it.repuestoId && !it.nombre?.trim()) {
      errores.push(`${n}: falta el repuesto.`);
    }
    if (it.tipo === "otro" && !it.otroId && !it.nuevo?.nombre.trim()) {
      errores.push(`${n}: falta el producto.`);
    }
    const serie = serieDeItem(it).toUpperCase();
    if (serie) {
      if (vistas.has(serie)) errores.push(`${n}: el IMEI/serie ${serie} está repetido en la compra.`);
      else if (existentes.has(serie)) errores.push(`${n}: el IMEI/serie ${serie} ya está en el stock.`);
      vistas.add(serie);
    }
  });
  return errores;
}
