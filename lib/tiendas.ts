// Tiendas / páginas de una organización (lógica pura, con test). Un negocio
// puede vender desde más de una página con la misma cuenta (ej. Hellstore y
// Heavenstore); la venta guarda cuál. La tienda principal es el nombre de la
// organización y no es una fila de `tiendas`.

import type { Tienda, TiendaSeleccion } from "@/lib/types";

export const TIENDA_NOMBRE_MAX = 60;

/** Espacios colapsados y recortados («  Heaven   Store » → «Heaven Store»). */
export function normalizarNombreTienda(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ");
}

const clave = (nombre: string) => normalizarNombreTienda(nombre).toLocaleLowerCase("es");

export type TiendaResuelta =
  | { ok: true; accion: "principal" }
  | { ok: true; accion: "usar"; id: string; nombre: string }
  | { ok: true; accion: "crear"; nombre: string }
  | { ok: false; error: string };

/**
 * Qué hacer con la tienda elegida en Nueva venta. Una «nueva» con el mismo
 * nombre (sin importar mayúsculas/espacios) que una existente la reusa, y
 * con el nombre de la principal es la principal: nunca se duplica.
 */
export function resolverTienda(
  sel: TiendaSeleccion | undefined,
  tiendas: Tienda[],
  nombrePrincipal: string,
): TiendaResuelta {
  if (!sel || sel.tipo === "principal") return { ok: true, accion: "principal" };
  if (sel.tipo === "existente") {
    const t = tiendas.find((x) => x.id === sel.id);
    if (!t) return { ok: false, error: "La tienda elegida no existe." };
    return { ok: true, accion: "usar", id: t.id, nombre: t.nombre };
  }
  const nombre = normalizarNombreTienda(sel.nombre);
  if (!nombre) return { ok: false, error: "Escribí el nombre de la tienda." };
  if (nombre.length > TIENDA_NOMBRE_MAX) {
    return { ok: false, error: `El nombre de la tienda no puede pasar de ${TIENDA_NOMBRE_MAX} caracteres.` };
  }
  if (clave(nombre) === clave(nombrePrincipal)) return { ok: true, accion: "principal" };
  const existente = tiendas.find((t) => clave(t.nombre) === clave(nombre));
  if (existente) return { ok: true, accion: "usar", id: existente.id, nombre: existente.nombre };
  return { ok: true, accion: "crear", nombre };
}
