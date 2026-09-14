import { z } from "zod";
import type { EquipoInput } from "@/lib/db/inventario";
import type { EquipoStatus } from "@/lib/types";

// ─────────────────────── Equipos ───────────────────────

export const EQUIPO_CSV_HEADERS = [
  "modelo",
  "almacenamiento",
  "color",
  "imei",
  "bateria",
  "condicion",
  "costoUsd",
  "precioUsd",
  "estado",
] as const;

export const CLIENTE_CSV_HEADERS = ["nombre", "telefono", "email", "fechaNacimiento"] as const;

const ESTADOS_EQUIPO: EquipoStatus[] = ["en_revision", "disponible", "reservado", "vendido"];

/** Valida que el CSV subido tenga todas las columnas esperadas (matching
 * trim + case-insensitive) y devuelve las filas re-clavadas con los nombres
 * canónicos exactos -- necesario porque `parseEquipoRow`/`parseClienteRow`
 * leen claves exactas (`raw.modelo`, no `raw.Modelo`) y Papa.parse conserva
 * el casing tal cual viene en el archivo. */
export function remapFilas(
  headersCanonicos: readonly string[],
  filas: Record<string, string>[],
): { ok: true; filas: Record<string, string>[] } | { ok: false; faltantes: string[] } {
  if (filas.length === 0) return { ok: true, filas: [] };
  const headersArchivo = Object.keys(filas[0]);
  const lookup = new Map(headersArchivo.map((h) => [h.trim().toLowerCase(), h]));
  const faltantes = headersCanonicos.filter((h) => !lookup.has(h.toLowerCase()));
  if (faltantes.length > 0) return { ok: false, faltantes };

  const filasRemapeadas = filas.map((fila) => {
    const out: Record<string, string> = {};
    for (const h of headersCanonicos) {
      const original = lookup.get(h.toLowerCase())!;
      out[h] = fila[original] ?? "";
    }
    return out;
  });
  return { ok: true, filas: filasRemapeadas };
}

// El schema opera sobre strings crudas del CSV (vía Papa.parse header:true)
// -- coerciona números, valida el enum de estado, y deja todo lo demás
// opcional. `estado` vacío se completa a "en_revision" en `parseEquipoRow`,
// mismo default que el alta manual en `EquipoFormDialog`.
const equipoCsvSchema = z.object({
  modelo: z.string().trim().min(1, "modelo es obligatorio"),
  almacenamiento: z.string().trim().optional().default(""),
  color: z.string().trim().optional().default(""),
  imei: z.string().trim().optional().default(""),
  bateria: z.coerce.number().int().min(0).max(100).optional().default(100),
  condicion: z.string().trim().optional().default(""),
  costoUsd: z.coerce.number().min(0, "costoUsd debe ser un número >= 0"),
  precioUsd: z.coerce.number().min(0, "precioUsd debe ser un número >= 0"),
  estado: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || ESTADOS_EQUIPO.includes(v as EquipoStatus), {
      message: `estado debe ser una de: ${ESTADOS_EQUIPO.join(", ")} (o vacío)`,
    })
    .optional()
    .default(""),
});

export type ParseResult<T> =
  | { ok: true; rowNum: number; data: T }
  | { ok: false; rowNum: number; error: string };

/** `rowNum` es 1-based y cuenta solo filas de datos (no el header), para
 * que el mensaje de error coincida con lo que el usuario ve en la planilla. */
export function parseEquipoRow(raw: Record<string, string>, rowNum: number): ParseResult<EquipoInput> {
  const parsed = equipoCsvSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, rowNum, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;
  return {
    ok: true,
    rowNum,
    data: {
      modelo: d.modelo,
      almacenamiento: d.almacenamiento,
      color: d.color,
      imei: d.imei,
      bateria: d.bateria,
      condicion: d.condicion,
      costoUsd: d.costoUsd,
      precioUsd: d.precioUsd,
      estado: (d.estado || "en_revision") as EquipoStatus,
    },
  };
}

/** Dedupe DENTRO del archivo -- pura, reusada por el preview client-side y
 * por la Server Action. IMEIs vacíos nunca chocan entre sí (mismo criterio
 * que el `UNIQUE (organization_id, imei)` de la tabla). */
export function marcarImeiDuplicadoEnArchivo(
  rows: { rowNum: number; imei: string }[],
): Map<number, string> {
  const vistos = new Map<string, number>();
  const dup = new Map<number, string>();
  for (const r of rows) {
    const imei = r.imei.trim();
    if (!imei) continue;
    const prev = vistos.get(imei);
    if (prev !== undefined) {
      dup.set(r.rowNum, `IMEI duplicado en el archivo (fila ${prev})`);
    } else {
      vistos.set(imei, r.rowNum);
    }
  }
  return dup;
}

// Columna extra "notas" a la derecha de los datos -- `remapFilas` solo lee
// las columnas de `EQUIPO_CSV_HEADERS` por nombre, así que una columna de
// más (o de menos, si el usuario la borra al preparar su archivo real) no
// rompe nada. Ninguna nota puede llevar coma: se arma el CSV a mano
// (`.join(",")`), sin escapado de comillas.
export function equipoTemplateCsv(): string {
  const headers = [...EQUIPO_CSV_HEADERS, "notas"];
  const ejemplo = [
    "iPhone 13",
    "128GB",
    "Azul",
    "353456789012345",
    "92",
    "A",
    "300",
    "450",
    "en_revision",
    "Fila de ejemplo -- borrala junto con las filas de notas de abajo antes de importar",
  ];
  const notas = [
    "estado: en_revision / disponible / reservado / vendido -- vacío se completa como en_revision",
    "condicion: texto libre (ej. A / B / C) -- usá tu propia escala de grados",
    "imei: no repetir -- si dos filas tienen el mismo IMEI (o ya existe en el inventario) esa fila se marca como duplicada y no se importa",
    "bateria: número entero de 0 a 100 -- vacío se completa como 100",
    "costoUsd / precioUsd: números en dólares sin símbolo ni puntos de miles (ej. 300)",
  ].map((nota) => [...Array(EQUIPO_CSV_HEADERS.length).fill(""), nota].join(","));

  return [headers.join(","), ejemplo.join(","), ...notas].join("\n");
}

// ─────────────────────── Clientes ───────────────────────

export type ClienteImportInput = {
  nombre: string;
  telefono: string;
  email: string;
  fechaNacimiento?: string;
};

/** Acepta `DD/MM/AAAA` o `AAAA-MM-DD`; a diferencia del diálogo manual
 * (que descarta en silencio una fecha inválida), en un import masivo una
 * fecha con formato o rango inválido es un ERROR reportado por fila. */
function normalizarFecha(raw: string): { ok: true; iso?: string } | { ok: false } {
  const v = raw.trim();
  if (!v) return { ok: true, iso: undefined };
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return validarFecha(iso[1], iso[2], iso[3]) ? { ok: true, iso: v } : { ok: false };
  const ddmm = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmm) {
    const [, dd, mm, yyyy] = ddmm;
    return validarFecha(yyyy, mm, dd) ? { ok: true, iso: `${yyyy}-${mm}-${dd}` } : { ok: false };
  }
  return { ok: false };
}
function validarFecha(yyyy: string, mm: string, dd: string): boolean {
  const y = Number(yyyy);
  const mo = Number(mm);
  const d = Number(dd);
  return y >= 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
}

const clienteCsvSchema = z.object({
  nombre: z.string().trim().min(1, "nombre es obligatorio"),
  telefono: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default(""),
  fechaNacimiento: z.string().trim().optional().default(""),
});

export function parseClienteRow(
  raw: Record<string, string>,
  rowNum: number,
): ParseResult<ClienteImportInput> {
  const parsed = clienteCsvSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, rowNum, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;
  const fecha = normalizarFecha(d.fechaNacimiento);
  if (!fecha.ok) {
    return {
      ok: false,
      rowNum,
      error: "fechaNacimiento inválida (usar DD/MM/AAAA o AAAA-MM-DD)",
    };
  }
  return {
    ok: true,
    rowNum,
    data: { nombre: d.nombre, telefono: d.telefono, email: d.email, fechaNacimiento: fecha.iso },
  };
}

/** Dedupe DENTRO del archivo para clientes, por teléfono o email
 * (normalizados) -- misma clave que se usa contra la DB en la Server
 * Action. */
export function marcarClienteDuplicadoEnArchivo(
  rows: { rowNum: number; telefono: string; email: string }[],
): Map<number, string> {
  const vistos = new Map<string, number>();
  const dup = new Map<number, string>();
  for (const r of rows) {
    const claves = [r.telefono.trim().toLowerCase(), r.email.trim().toLowerCase()].filter(Boolean);
    let match: number | undefined;
    for (const k of claves) {
      const prev = vistos.get(k);
      if (prev !== undefined) match = prev;
    }
    if (match !== undefined) {
      dup.set(r.rowNum, `Teléfono/email duplicado en el archivo (fila ${match})`);
    } else {
      for (const k of claves) vistos.set(k, r.rowNum);
    }
  }
  return dup;
}

// Misma idea que `equipoTemplateCsv`: columna extra "notas" a la derecha,
// ignorada por `remapFilas` -- ninguna nota puede llevar coma.
export function clienteTemplateCsv(): string {
  const headers = [...CLIENTE_CSV_HEADERS, "notas"];
  const ejemplo = [
    "Juan Perez",
    "+5491122334455",
    "juan@mail.com",
    "15/05/1990",
    "Fila de ejemplo -- borrala junto con las filas de notas de abajo antes de importar",
  ];
  const notas = [
    "nombre: es el único dato obligatorio",
    "telefono / email: opcionales -- pero si un cliente ya cargado tiene el mismo teléfono o email esa fila se marca como duplicada y no se importa",
    "fechaNacimiento: opcional -- formato DD/MM/AAAA o AAAA-MM-DD; si la escribís mal la fila se marca con error (no se importa sin fecha en silencio)",
  ].map((nota) => [...Array(CLIENTE_CSV_HEADERS.length).fill(""), nota].join(","));

  return [headers.join(","), ejemplo.join(","), ...notas].join("\n");
}
