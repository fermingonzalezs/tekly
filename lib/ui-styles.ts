/** Filtros de sección (selects/inputs de búsqueda): pill que hace juego con
 * los botones `outline` (plan 010) -- mismo alto/radio/borde/foco, sin ser un
 * `Button`. */
export const filterPill =
  "truncate rounded-full border-neutral-900/10 text-neutral-900 hover:border-neutral-900/20 focus:border-accent";

/** Separador fino entre headers de tabla: línea blanca corta (no ocupa
 * todo el alto de la celda). Va en el `th`, menos en el último de la fila. */
export const thDivider =
  "relative after:absolute after:right-0 after:top-1/2 after:h-4 after:w-px after:-translate-y-1/2 after:bg-white after:content-['']";
