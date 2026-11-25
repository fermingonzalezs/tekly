import type { PedidoItem } from "@/lib/types";

/** Fila de la tabla de productos mientras se edita: todo string, para que un
 * input pueda quedar vacío (y `errorPedido` lo rechace si hace falta). Se
 * convierte con `normalizarItems` al guardar. */
export type PedidoItemBorrador = {
  detalle: string;
  cantidad: string;
  precioUsd: string;
};

/** Fila vacía de la tabla de productos. */
export const itemPedidoVacio = (): PedidoItemBorrador => ({
  detalle: "",
  cantidad: "1",
  precioUsd: "",
});

/** Cualquier fila de producto, venga del formulario (strings) o del server
 * (números): la validación y los totales aceptan las dos. */
export type PedidoItemValidable = {
  detalle: string;
  cantidad: number | string;
  precioUsd: number | string;
};

/** String vacío → `NaN` (no 0): un precio sin cargar tiene que fallar la
 * validación, no guardarse gratis. Tolera `null`/`undefined` porque una
 * server action recibe JSON (un `NaN` del cliente llega como `null`). */
const numeroDe = (v: number | string | null | undefined): number => {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return Number.NaN;
  return v.trim() === "" ? Number.NaN : Number(v);
};

/** Detalle como texto, aunque el payload llegue con otra cosa. */
const textoDe = (v: unknown): string => (typeof v === "string" ? v : "");

/** Redondeo a centavos — evita los arrastres de `0.1 + 0.2`. */
export const redondearUsd = (n: number): number => Math.round(n * 100) / 100;

/** Descarta las filas totalmente vacías (sin detalle ni precio), así la fila
 * que se agrega con «+» y se deja en blanco no rompe la validación. */
export function limpiarItems<T extends { detalle: string; precioUsd: number | string }>(
  items: T[],
): T[] {
  return items.filter(
    (i) => textoDe(i.detalle).trim() !== "" || numeroDe(i.precioUsd) > 0,
  );
}

/** Subtotal de una fila (`precio × cantidad`); 0 mientras la fila todavía no
 * es válida (así la tabla y el resumen se dibujan sin romperse). */
export function subtotalItem(item: PedidoItemValidable): number {
  const cantidad = numeroDe(item.cantidad);
  const precio = numeroDe(item.precioUsd);
  if (!Number.isFinite(cantidad) || !Number.isFinite(precio) || cantidad <= 0 || precio < 0) {
    return 0;
  }
  return redondearUsd(cantidad * precio);
}

/** Total del pedido = suma de subtotales, redondeada a centavos. */
export function totalPedido(items: PedidoItemValidable[]): number {
  return redondearUsd(items.reduce((acc, i) => acc + subtotalItem(i), 0));
}

/** Saldo por abonar = total − seña, nunca negativo. */
export function saldoPedido(
  items: PedidoItemValidable[],
  senaUsd: number | string,
): number {
  const sena = numeroDe(senaUsd);
  return Math.max(0, redondearUsd(totalPedido(items) - (Number.isFinite(sena) ? sena : 0)));
}

/** Borrador (strings) → ítems persistidos: `cantidad` entera y `precioUsd` a
 * centavos. Un valor vacío o inválido queda `NaN` para que `errorPedido` lo
 * rechace — nunca se inventa un número. */
export function normalizarItems(items: PedidoItemValidable[]): PedidoItem[] {
  return items.map((i) => ({
    detalle: textoDe(i.detalle).trim(),
    cantidad: Math.trunc(numeroDe(i.cantidad)),
    precioUsd: redondearUsd(numeroDe(i.precioUsd)),
  }));
}

/** `descripcion` de la fila (columna `not null` que siguen leyendo el chip,
 * el confirm de borrar y los pedidos viejos): se deriva de los ítems.
 * 1 ítem → su detalle; cantidad > 1 → "2× Funda"; más ítems → "+ N más". */
export function descripcionPedido(items: PedidoItemValidable[]): string {
  if (items.length === 0) return "";
  const [primero, ...resto] = items;
  const cantidad = numeroDe(primero.cantidad);
  const detalle = textoDe(primero.detalle).trim();
  const base = cantidad > 1 ? `${cantidad}× ${detalle}` : detalle;
  if (resto.length === 0) return base;
  return `${base} + ${resto.length} más`;
}

/** Validación del pedido (pura): la usan el dialog y la server action, que
 * siempre revalida. Devuelve el primer error, o `null` si está todo bien. */
export function errorPedido({
  items,
  senaUsd,
}: {
  items: PedidoItemValidable[];
  senaUsd: number | string;
}): string | null {
  if (items.length === 0) return "Agregá al menos un producto.";
  for (let i = 0; i < items.length; i++) {
    const n = i + 1;
    const item = items[i];
    if (!textoDe(item.detalle).trim()) return `Falta el detalle del producto ${n}.`;
    const cantidad = numeroDe(item.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      return `La cantidad del producto ${n} debe ser un entero mayor a 0.`;
    }
    const precio = numeroDe(item.precioUsd);
    if (!Number.isFinite(precio) || precio < 0) {
      return `Falta el precio del producto ${n}.`;
    }
  }
  const sena = numeroDe(senaUsd);
  if (!Number.isFinite(sena) || sena < 0) return "El monto de la seña no es válido.";
  if (sena > totalPedido(items)) return "La seña no puede superar el total.";
  return null;
}

// ── Seña con movimiento de caja ──

/** Seña tal como la carga el dialog: la caja elegida y el monto en **la
 * moneda de esa caja** (pesos si es ARS, como en Nueva venta). */
export type SenaCaja = {
  cajaId: string;
  /** En la moneda de la caja. */
  monto: number;
  /** ARS por USD del momento -- snapshot del movimiento. */
  cotizacion: number;
};

/** Monto del movimiento (moneda de la caja) y su equivalente en USD, que es
 * lo que se guarda en `pedidos.sena_usd`. `null` si el monto o la
 * cotización no sirven. */
export function senaEnCaja(
  moneda: "usd" | "ars",
  monto: number,
  cotizacion: number,
): { monto: number; senaUsd: number } | null {
  if (!Number.isFinite(monto) || monto <= 0) return null;
  if (moneda === "usd") {
    const usd = redondearUsd(monto);
    return { monto: usd, senaUsd: usd };
  }
  if (!Number.isFinite(cotizacion) || cotizacion <= 0) return null;
  const ars = Math.round(monto);
  return { monto: ars, senaUsd: redondearUsd(ars / cotizacion) };
}

/** Qué hacer con el movimiento de la seña al editar un pedido:
 * `"igual"` = misma caja y mismo monto, no se toca (aunque cambie el dólar);
 * `"reemplazar"` = se borra el anterior (si hay) y se crea el nuevo (si hay);
 * `"bloqueado"` = cambió pero el anterior ya está conciliado. */
export function cambioSena(
  anterior: { cajaId: string; monto: number; conciliado: boolean } | null,
  nueva: { cajaId: string; monto: number } | null,
): "igual" | "reemplazar" | "bloqueado" {
  if (!anterior && !nueva) return "igual";
  if (anterior && nueva && anterior.cajaId === nueva.cajaId && anterior.monto === nueva.monto) {
    return "igual";
  }
  return anterior?.conciliado ? "bloqueado" : "reemplazar";
}
