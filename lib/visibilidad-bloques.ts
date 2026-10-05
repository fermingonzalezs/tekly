// Visibilidad de los bloques "Gráficos" y "Tarjetas" de una sección con
// tabla (plan 009). Lógica pura, sin React, para poder testearla sin DOM:
// el hook `useVisibilidadBloques` (components/ui/use-visibilidad-bloques.ts)
// la envuelve y le pasa `localStorage` del navegador.

export type VisibilidadBloques = { graficos: boolean; tarjetas: boolean };
export type BloqueVisible = keyof VisibilidadBloques;

/** Estado inicial: ambos bloques visibles (también en SSR/primer render). */
export const VISIBILIDAD_DEFAULT: VisibilidadBloques = {
  graficos: true,
  tarjetas: true,
};

/** Clave de `localStorage` de una sección (una por `id`). */
export const visibilidadKey = (id: string) => `tekly:ui:${id}`;

/** Subconjunto de `Storage` que usa el módulo (facilita testear con un fake). */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    // Puede lanzar con storage bloqueado (modo privado / políticas).
    return null;
  }
}

/** Parseo defensivo del JSON guardado: cualquier valor no-booleano o JSON
 * roto cae al default del bloque. */
export function parseVisibilidad(raw: string | null): VisibilidadBloques {
  if (!raw) return { ...VISIBILIDAD_DEFAULT };
  try {
    const obj = JSON.parse(raw) as Partial<VisibilidadBloques> | null;
    return {
      graficos: typeof obj?.graficos === "boolean" ? obj.graficos : true,
      tarjetas: typeof obj?.tarjetas === "boolean" ? obj.tarjetas : true,
    };
  } catch {
    return { ...VISIBILIDAD_DEFAULT };
  }
}

/** Lee la visibilidad guardada de una sección; default si no hay o falla. */
export function leerVisibilidad(
  id: string,
  store: StorageLike | null = storage(),
): VisibilidadBloques {
  if (!store) return { ...VISIBILIDAD_DEFAULT };
  try {
    return parseVisibilidad(store.getItem(visibilidadKey(id)));
  } catch {
    return { ...VISIBILIDAD_DEFAULT };
  }
}

/** Persiste la visibilidad; nunca lanza si `localStorage` está bloqueado. */
export function guardarVisibilidad(
  id: string,
  estado: VisibilidadBloques,
  store: StorageLike | null = storage(),
): void {
  if (!store) return;
  try {
    store.setItem(visibilidadKey(id), JSON.stringify(estado));
  } catch {
    // Storage lleno o bloqueado: la visibilidad del render sigue andando.
  }
}
