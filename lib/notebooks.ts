import { z } from "zod";

/** Validación de una notebook (alta/edición). Pura, sin Supabase: la usa
 * `lib/db/notebooks.ts` en el server y tiene test en `lib/notebooks.test.ts`. */
export const notebookSchema = z.object({
  modelo: z.string().trim().min(1, "El modelo es obligatorio"),
  cpu: z.string().optional().default(""),
  memoria: z.string().optional().default(""),
  almacenamiento: z.string().optional().default(""),
  pantalla: z.string().optional().default(""),
  color: z.string().optional().default(""),
  idioma: z.string().optional().default(""),
  numeroSerie: z.string().optional().default(""),
  garantia: z.string().optional().default(""),
  notas: z.string().optional().default(""),
  costoUsd: z.number().min(0),
  precioUsd: z.number().min(0),
  estado: z.enum(["en_revision", "disponible", "reservado", "vendido", "extraviado"]),
  condicion: z.enum(["nuevo", "usado"]),
  bateria: z.number().int().min(0).max(100).nullable().default(null),
}).refine((n) => n.condicion === "nuevo" || n.bateria !== null, {
  path: ["bateria"],
  message: "Anotá el estado de la batería (0–100 %) de la notebook usada",
});

export type NotebookInput = z.infer<typeof notebookSchema>;
