// Carrito «Vender desde el stock»: el usuario va sumando unidades desde
// Inventario y, al confirmar, se abre «Nueva venta» con esas unidades ya
// cargadas. Lógica pura (sin `window`); el estado vive en `sessionStorage`
// vía `components/ventas/carrito-venta.tsx`.

export type TipoCarrito = "celular" | "notebook";

export type ItemCarrito = {
  tipo: TipoCarrito;
  id: string;
  /** Para mostrar en la barra sin tener que buscar la unidad. */
  nombre: string;
  precioUsd: number;
};

export const CARRITO_KEY = "tekly:carrito-venta:v1";

export const enCarrito = (carrito: ItemCarrito[], tipo: TipoCarrito, id: string): boolean =>
  carrito.some((i) => i.tipo === tipo && i.id === id);

/** Agrega o saca la unidad (cada unidad entra una sola vez). */
export function alternarEnCarrito(carrito: ItemCarrito[], item: ItemCarrito): ItemCarrito[] {
  return enCarrito(carrito, item.tipo, item.id)
    ? carrito.filter((i) => !(i.tipo === item.tipo && i.id === item.id))
    : [...carrito, item];
}

export const totalCarrito = (carrito: ItemCarrito[]): number =>
  carrito.reduce((a, i) => a + i.precioUsd, 0);

/** Lee el carrito guardado; cualquier cosa rara → vacío. */
export function parseCarrito(raw: string | null): ItemCarrito[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (i): i is ItemCarrito =>
        !!i &&
        typeof i === "object" &&
        (i.tipo === "celular" || i.tipo === "notebook") &&
        typeof i.id === "string" &&
        typeof i.nombre === "string" &&
        typeof i.precioUsd === "number",
    );
  } catch {
    return [];
  }
}

/** Al pasar a la venta, solo lo que sigue disponible en el stock (alguien
 * pudo venderlo mientras tanto). Devuelve lo que entra y lo que quedó afuera. */
export function filtrarDisponibles(
  carrito: ItemCarrito[],
  disponibles: { celulares: Set<string>; notebooks: Set<string> },
): { entran: ItemCarrito[]; afuera: ItemCarrito[] } {
  const entran: ItemCarrito[] = [];
  const afuera: ItemCarrito[] = [];
  for (const i of carrito) {
    const set = i.tipo === "celular" ? disponibles.celulares : disponibles.notebooks;
    (set.has(i.id) ? entran : afuera).push(i);
  }
  return { entran, afuera };
}
