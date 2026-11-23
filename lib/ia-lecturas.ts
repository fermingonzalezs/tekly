/** Cupo de "Leer con IA" en Importar datos: una lectura por tipo de carga
 * (celulares, notebooks, clientes) por organización, sin renovación, y largo
 * máximo del texto. Puro, sin Supabase -- lo usan la server action y la UI. */
export const IA_LECTURAS_POR_ENTIDAD = 1;
export const IA_MAX_CARACTERES = 20_000;

export const ENTIDADES_IMPORTACION = ["celulares", "notebooks", "clientes"] as const;
export type EntidadImportacion = (typeof ENTIDADES_IMPORTACION)[number];

export function lecturasRestantes(usadas: number): number {
  return Math.max(0, IA_LECTURAS_POR_ENTIDAD - usadas);
}

/** Mensaje de error si el texto no se puede mandar a leer, o null si está ok. */
export function validarTextoIa(texto: string): string | null {
  const largo = texto.trim().length;
  if (largo === 0) return "Pegá el texto que querés importar.";
  if (largo > IA_MAX_CARACTERES) {
    return `El texto es muy largo (${largo.toLocaleString("es-AR")} caracteres). El máximo es ${IA_MAX_CARACTERES.toLocaleString("es-AR")}.`;
  }
  return null;
}
