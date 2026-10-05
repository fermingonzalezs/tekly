/** Tamaño de página compartido por las tablas paginadas en el server. */
export const PAGE_SIZE = 50;

/** Números de página a mostrar (con elipsis) alrededor de la actual. La
 * ventana es: primera, última, actual y sus vecinas. Elipsis solo cuando hay
 * un salto real entre dos números consecutivos de la lista. */
export function paginasVisibles(
  actual: number,
  total: number,
): (number | "…")[] {
  if (total <= 1) return total === 1 ? [1] : [];
  const todas = Array.from({ length: total }, (_, i) => i + 1);
  if (total <= 7) return todas;

  const visibles = new Set<number>([1, total, actual, actual - 1, actual + 1]);
  const numeros = [...visibles]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);

  const out: (number | "…")[] = [];
  let previo = 0;
  for (const n of numeros) {
    if (previo && n - previo > 1) out.push("…");
    out.push(n);
    previo = n;
  }
  return out;
}
