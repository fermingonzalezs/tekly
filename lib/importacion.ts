import { z } from "zod";
import type { CelularInput } from "@/lib/db/inventario";
import type { NotebookInput } from "@/lib/notebooks";
import type { CelularStatus, NotebookCondicion } from "@/lib/types";
import { CONDICIONES_CELULAR, celularStatus } from "@/lib/status";
import { fmtUsd } from "@/lib/format";

// ─────────────────────── Celulares ───────────────────────

export const CELULAR_CSV_HEADERS = [
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

const ESTADOS_CELULAR: CelularStatus[] = ["en_revision", "disponible", "reservado", "vendido"];

/** Valida que el CSV subido tenga todas las columnas esperadas (matching
 * trim + case-insensitive) y devuelve las filas re-clavadas con los nombres
 * canónicos exactos -- necesario porque `parseCelularRow`/`parseClienteRow`
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
// opcional. `estado` vacío se completa a `ESTADO_IMPORT_DEFAULT`
// (`disponible`) en `parseCelularRow`.
/** Estado de stock de una fila importada: vacío → `disponible` (lo que se
 * importa suele ser stock a la venta; antes era `en_revision`). */
export const ESTADO_IMPORT_DEFAULT: CelularStatus = "disponible";

const estadoSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || ESTADOS_CELULAR.includes(v as CelularStatus), {
    message: `estado debe ser una de: ${ESTADOS_CELULAR.join(", ")} (o vacío)`,
  })
  .optional()
  .default("");

/** Monto en dólares escrito como venga ("1300", "1.300", "U$ 1.300",
 * "1,300.50") → número como string ("1300", "1300.5"); "" si no hay dígitos.
 * Un separador seguido de 1-2 dígitos al final es decimal; si no, de miles. */
export function normalizarMonto(v: string): string {
  const sinMoneda = (v ?? "").replace(/d[oó]lares|dolar|d[oó]lar|usd|u\$s|us\$|u\$|\$|\s/gi, "");
  if (sinMoneda === "") return "";
  // Algo que no es un monto ("abc", "a consultar") → "": la celda guarda solo
  // números (el `U$` es solo cómo se muestra). `montoSchema` igual lo marca
  // como error si llega así al server.
  if (/[^\d.,]/.test(sinMoneda) || !/\d/.test(sinMoneda)) return "";
  const limpio = sinMoneda;
  const m = limpio.match(/^(.*?)[.,](\d{1,2})$/);
  const entero = (m ? m[1] : limpio).replace(/[.,]/g, "");
  const n = Number(`${entero || "0"}${m ? `.${m[2]}` : ""}`);
  return String(n);
}

const montoSchema = (campo: string) =>
  z
    .string()
    .optional()
    .default("")
    .superRefine((v, ctx) => {
      if (v.trim() && normalizarMonto(v) === "") {
        ctx.addIssue({ code: "custom", message: `${campo} tiene que ser un número en dólares (ej. 1300)` });
      }
    })
    .transform((v) => Number(normalizarMonto(v) || "0"))
    .pipe(z.number().min(0, `${campo} debe ser un número >= 0`));

/** Batería de un equipo usado: obligatoria, entero 0-100. `null` si no vale. */
function bateriaUsado(v: string): number | null {
  const n = Number(v.replace("%", "").trim());
  return v.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
}

const celularCsvSchema = z.object({
  // Columna virtual de la tabla de revisión (no está en el CSV): la variante
  // se elige por fila y es obligatoria.
  varianteId: z.string().trim().min(1, "Elegí la variante"),
  modelo: z.string().trim().min(1, "modelo es obligatorio"),
  almacenamiento: z.string().trim().optional().default(""),
  color: z.string().trim().optional().default(""),
  imei: z.string().trim().min(1, "imei es obligatorio (IMEI o número de serie)"),
  bateria: z.string().trim().optional().default(""),
  // Uno de los grados reales (`CONDICIONES_CELULAR`), sin importar mayúsculas.
  condicion: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => (CONDICIONES_CELULAR as readonly string[]).includes(v), {
      message: `condicion debe ser una de: ${CONDICIONES_CELULAR.join(", ")}`,
    }),
  costoUsd: montoSchema("costoUsd"),
  precioUsd: montoSchema("precioUsd"),
  estado: estadoSchema,
});

export type ParseResult<T> =
  | { ok: true; rowNum: number; data: T }
  | { ok: false; rowNum: number; error: string };

/** `rowNum` es 1-based y cuenta solo filas de datos (no el header), para
 * que el mensaje de error coincida con lo que el usuario ve en la planilla. */
export function parseCelularRow(raw: Record<string, string>, rowNum: number): ParseResult<CelularInput> {
  const parsed = celularCsvSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, rowNum, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;
  // NUEVO: la batería no aplica (va al 100 %). Usado: obligatoria.
  let bateria = 100;
  if (d.condicion !== "NUEVO") {
    const b = bateriaUsado(d.bateria);
    if (b === null) {
      return { ok: false, rowNum, error: "bateria es obligatoria en los usados (entero de 0 a 100)" };
    }
    bateria = b;
  }
  return {
    ok: true,
    rowNum,
    data: {
      varianteId: d.varianteId,
      modelo: d.modelo,
      almacenamiento: d.almacenamiento,
      color: d.color,
      imei: d.imei,
      bateria,
      condicion: d.condicion,
      costoUsd: d.costoUsd,
      precioUsd: d.precioUsd,
      estado: (d.estado || ESTADO_IMPORT_DEFAULT) as CelularStatus,
      // Lo importado conserva el precio de la planilla: no lo pisa el de la
      // variante al editarla.
      precioPropio: true,
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
// las columnas de `CELULAR_CSV_HEADERS` por nombre, así que una columna de
// más (o de menos, si el usuario la borra al preparar su archivo real) no
// rompe nada. Ninguna nota puede llevar coma: se arma el CSV a mano
// (`.join(",")`), sin escapado de comillas.
export function celularTemplateCsv(): string {
  const headers = [...CELULAR_CSV_HEADERS, "notas"];
  const ejemplo = [
    "iPhone 13",
    "128GB",
    "Azul",
    "353456789012345",
    "92",
    "A",
    "300",
    "450",
    "disponible",
    "Fila de ejemplo -- borrala junto con las filas de notas de abajo antes de importar",
  ];
  const notas = [
    "estado: en_revision / disponible / reservado / vendido -- vacío se completa como disponible",
    `condicion: una de ${CONDICIONES_CELULAR.join(" / ")} (obligatoria)`,
    "imei: obligatorio y sin repetir -- si dos filas tienen el mismo IMEI (o ya existe en el inventario) esa fila se marca como duplicada y no se importa",
    "bateria: entero de 0 a 100 sin % -- obligatoria en los usados; en NUEVO dejala vacía",
    "color: el color del equipo si figura en el texto (en español: Negro / Blanco / Azul / Titanio natural...) -- vacío si no figura",
    "costoUsd / precioUsd: números en dólares sin símbolo ni puntos de miles (ej. 300) -- costoUsd es lo que costó y precioUsd el precio de venta",
  ].map((nota) => [...Array(CELULAR_CSV_HEADERS.length).fill(""), nota].join(","));

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

// Misma idea que `celularTemplateCsv`: columna extra "notas" a la derecha,
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

// ─────────────────────── Notebooks ───────────────────────

export const NOTEBOOK_CSV_HEADERS = [
  "modelo",
  "cpu",
  "memoria",
  "almacenamiento",
  "pantalla",
  "resolucion",
  "gpu",
  "color",
  "idioma",
  "numeroSerie",
  "garantia",
  "observaciones",
  "condicion",
  "bateria",
  "ciclosBateria",
  "costoUsd",
  "precioUsd",
  "estado",
] as const;

export const CONDICIONES_NOTEBOOK: NotebookCondicion[] = ["nuevo", "usado"];

// `observaciones` se mapea a `Notebook.notas` (el header "notas" queda libre
// para la columna de instrucciones de la plantilla). `bateria` solo cuenta en
// las usadas, igual que en el alta manual (`notebookSchema`).
const notebookCsvSchema = z.object({
  // Columna virtual de la revisión (no está en el CSV), igual que celulares.
  varianteId: z.string().trim().min(1, "Elegí la variante"),
  modelo: z.string().trim().min(1, "modelo es obligatorio"),
  cpu: z.string().trim().optional().default(""),
  memoria: z.string().trim().optional().default(""),
  almacenamiento: z.string().trim().optional().default(""),
  pantalla: z.string().trim().optional().default(""),
  resolucion: z.string().trim().optional().default(""),
  gpu: z.string().trim().optional().default(""),
  color: z.string().trim().optional().default(""),
  idioma: z.string().trim().optional().default(""),
  numeroSerie: z.string().trim().min(1, "numeroSerie es obligatorio"),
  garantia: z.string().trim().optional().default(""),
  observaciones: z.string().trim().optional().default(""),
  condicion: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => CONDICIONES_NOTEBOOK.includes(v as NotebookCondicion), {
      message: `condicion debe ser una de: ${CONDICIONES_NOTEBOOK.join(", ")}`,
    }),
  bateria: z.string().trim().optional().default(""),
  ciclosBateria: z.string().trim().optional().default(""),
  costoUsd: montoSchema("costoUsd"),
  precioUsd: montoSchema("precioUsd"),
  estado: estadoSchema,
});

export function parseNotebookRow(
  raw: Record<string, string>,
  rowNum: number,
): ParseResult<NotebookInput> {
  const parsed = notebookCsvSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, rowNum, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;
  const condicion = d.condicion as NotebookCondicion;
  let bateria: number | null = null;
  if (condicion === "usado") {
    const n = bateriaUsado(d.bateria);
    if (n === null) {
      return {
        ok: false,
        rowNum,
        error: "bateria es obligatoria en las usadas (entero de 0 a 100)",
      };
    }
    bateria = n;
  }
  let ciclosBateria: number | null = null;
  if (condicion === "usado" && d.ciclosBateria !== "") {
    const n = Number(d.ciclosBateria.replace(/\./g, ""));
    if (!Number.isInteger(n) || n < 0) {
      return { ok: false, rowNum, error: "ciclosBateria tiene que ser un entero >= 0" };
    }
    ciclosBateria = n;
  }
  return {
    ok: true,
    rowNum,
    data: {
      modelo: d.modelo,
      cpu: d.cpu,
      memoria: d.memoria,
      almacenamiento: d.almacenamiento,
      pantalla: d.pantalla,
      resolucion: d.resolucion,
      gpu: d.gpu,
      color: d.color,
      idioma: d.idioma,
      numeroSerie: d.numeroSerie,
      garantia: d.garantia,
      notas: d.observaciones,
      costoUsd: d.costoUsd,
      precioUsd: d.precioUsd,
      estado: (d.estado || ESTADO_IMPORT_DEFAULT) as CelularStatus,
      condicion,
      bateria,
      ciclosBateria,
      varianteId: d.varianteId,
      // Lo importado conserva el precio de la planilla (como celulares).
      precioPropio: true,
    },
  };
}

/** Dedupe DENTRO del archivo por número de serie -- series vacías nunca
 * chocan entre sí. */
export function marcarSerieDuplicadaEnArchivo(
  rows: { rowNum: number; numeroSerie: string }[],
): Map<number, string> {
  const vistos = new Map<string, number>();
  const dup = new Map<number, string>();
  for (const r of rows) {
    const serie = r.numeroSerie.trim();
    if (!serie) continue;
    const prev = vistos.get(serie);
    if (prev !== undefined) {
      dup.set(r.rowNum, `Número de serie duplicado en el archivo (fila ${prev})`);
    } else {
      vistos.set(serie, r.rowNum);
    }
  }
  return dup;
}

// Columna extra "instrucciones" a la derecha, ignorada por `remapFilas`;
// ninguna nota puede llevar coma (el CSV se arma a mano).
export function notebookTemplateCsv(): string {
  const headers = [...NOTEBOOK_CSV_HEADERS, "instrucciones"];
  const ejemplo = [
    "MacBook Air M2",
    "Apple M2",
    "8GB",
    "256GB",
    "13.6 pulgadas",
    "2560 x 1664",
    "Integrada",
    "Gris espacial",
    "Español",
    "C02XYZ123456",
    "6 meses",
    "",
    "usado",
    "95",
    "120",
    "800",
    "1000",
    "disponible",
    "Fila de ejemplo -- borrala junto con las filas de notas de abajo antes de importar",
  ];
  const notas = [
    "condicion: nuevo o usado (obligatoria)",
    "bateria: entero de 0 a 100 -- obligatoria si es usado; en las nuevas se ignora",
    "ciclosBateria: ciclos de carga (entero) -- opcional y solo en las usadas",
    "pantalla: tamaño en pulgadas (ej. 13.6) -- es parte de la variante",
    "resolucion: opcional (ej. 2560 x 1664)",
    "numeroSerie: obligatorio y sin repetir -- si ya existe en el inventario (o se repite en el archivo) la fila se marca como duplicada y no se importa",
    "estado: en_revision / disponible / reservado / vendido -- vacío se completa como disponible",
    "costoUsd / precioUsd: números en dólares sin símbolo ni puntos de miles (ej. 800)",
    "observaciones: texto libre sin comas",
  ].map((nota) => [...Array(NOTEBOOK_CSV_HEADERS.length).fill(""), nota].join(","));

  return [headers.join(","), ejemplo.join(","), ...notas].join("\n");
}

// ─────────────────────── Preview (CSV o IA) ───────────────────────

export type FilaCruda = { rowNum: number; raw: Record<string, string> };
export type EstadoFilaPreview = {
  rowNum: number;
  status: "ok" | "error" | "duplicate";
  detail?: string;
};

/** Estado de cada fila del preview (válida, con error o duplicada dentro del
 * archivo). Pura: la tabla editable la recalcula en cada cambio, así que
 * corregir una celda actualiza el estado al instante. */
export function evaluarFilas<T>(
  filas: FilaCruda[],
  parseRow: (raw: Record<string, string>, rowNum: number) => ParseResult<T>,
  marcarDuplicados: (validos: { rowNum: number; data: T }[]) => Map<number, string>,
): EstadoFilaPreview[] {
  const estados = new Map<number, EstadoFilaPreview>();
  const validos: { rowNum: number; data: T }[] = [];
  for (const { rowNum, raw } of filas) {
    const parsed = parseRow(raw, rowNum);
    if (parsed.ok) validos.push({ rowNum, data: parsed.data });
    else estados.set(rowNum, { rowNum, status: "error", detail: parsed.error });
  }
  const duplicadas = marcarDuplicados(validos);
  for (const { rowNum } of validos) {
    const detail = duplicadas.get(rowNum);
    estados.set(rowNum, detail ? { rowNum, status: "duplicate", detail } : { rowNum, status: "ok" });
  }
  return filas.map((f) => estados.get(f.rowNum)!);
}

// ─────────────────── Columnas de la tabla de revisión ───────────────────

/** Cómo se muestra/edita cada columna en la tabla editable de Importar datos
 * (la de después de subir un CSV o leer con IA). */
export type ColumnaImport = {
  label: string;
  /** Valores cerrados → desplegable en vez de texto libre. */
  opciones?: readonly { value: string; label: string }[];
  /** Valor que toma la celda si viene vacía. */
  porDefecto?: string;
  /** Monto en dólares: se muestra como `U$ 1.300`. */
  monto?: boolean;
  /** Solo dígitos (ej. batería: "100%" → "100"). */
  entero?: boolean;
  /** La celda no aplica para esta fila (se deshabilita y se vacía). */
  deshabilitada?: (fila: Record<string, string>) => boolean;
};

const OPCIONES_ESTADO = ESTADOS_CELULAR.map((e) => ({ value: e, label: celularStatus[e].label }));

const COL_ESTADO: ColumnaImport = {
  label: "Estado",
  opciones: OPCIONES_ESTADO,
  porDefecto: ESTADO_IMPORT_DEFAULT,
};

export const COLUMNAS_CELULAR: Record<string, ColumnaImport> = {
  estado: COL_ESTADO,
  varianteId: { label: "Variante" },
  modelo: { label: "Modelo" },
  almacenamiento: { label: "Almacenamiento" },
  color: { label: "Color" },
  imei: { label: "IMEI" },
  condicion: {
    label: "Condición",
    opciones: CONDICIONES_CELULAR.map((c) => ({ value: c, label: c })),
  },
  bateria: {
    label: "Batería",
    entero: true,
    deshabilitada: (f) => (f.condicion ?? "").trim().toUpperCase() === "NUEVO",
  },
  costoUsd: { label: "Costo USD", monto: true },
  precioUsd: { label: "Precio USD", monto: true },
};

export const COLUMNAS_NOTEBOOK: Record<string, ColumnaImport> = {
  estado: COL_ESTADO,
  varianteId: { label: "Variante" },
  modelo: { label: "Modelo" },
  cpu: { label: "CPU" },
  memoria: { label: "Memoria" },
  almacenamiento: { label: "Almacenamiento" },
  pantalla: { label: "Pantalla" },
  resolucion: { label: "Resolución" },
  gpu: { label: "GPU" },
  color: { label: "Color" },
  idioma: { label: "Idioma" },
  numeroSerie: { label: "N° de serie" },
  garantia: { label: "Garantía" },
  observaciones: { label: "Observaciones" },
  condicion: {
    label: "Condición",
    opciones: CONDICIONES_NOTEBOOK.map((c) => ({ value: c, label: c === "nuevo" ? "Nueva" : "Usada" })),
  },
  bateria: {
    label: "Batería",
    entero: true,
    deshabilitada: (f) => (f.condicion ?? "").trim().toLowerCase() !== "usado",
  },
  ciclosBateria: {
    label: "Ciclos",
    entero: true,
    deshabilitada: (f) => (f.condicion ?? "").trim().toLowerCase() !== "usado",
  },
  costoUsd: { label: "Costo USD", monto: true },
  precioUsd: { label: "Precio USD", monto: true },
};

export const COLUMNAS_CLIENTE: Record<string, ColumnaImport> = {
  nombre: { label: "Nombre" },
  telefono: { label: "Teléfono" },
  email: { label: "Email" },
  fechaNacimiento: { label: "Nacimiento" },
};

/** Orden de la tabla: `estado` (si la entidad lo tiene) va primero. */
export function ordenColumnas(headers: readonly string[]): string[] {
  return headers.includes("estado") ? ["estado", ...headers.filter((h) => h !== "estado")] : [...headers];
}

/** Completa defaults, vacía las celdas que no aplican y normaliza montos.
 * Se aplica al armar la tabla y después de cada cambio de celda. */
export function completarFila(
  fila: Record<string, string>,
  columnas: Record<string, ColumnaImport>,
): Record<string, string> {
  const out = { ...fila };
  for (const [campo, col] of Object.entries(columnas)) {
    const v = out[campo] ?? "";
    if (col.porDefecto && !v.trim()) out[campo] = col.porDefecto;
    else if (col.opciones) out[campo] = opcionDe(col, v)?.value ?? v;
    if (col.monto) out[campo] = normalizarMonto(v);
    if (col.entero) out[campo] = v.replace(/\D/g, "");
    if (col.deshabilitada?.(out)) out[campo] = "";
  }
  return out;
}

/** Opción que corresponde a un valor crudo (sin mayúsculas ni espacios). */
export function opcionDe(
  col: ColumnaImport,
  valor: string,
): { value: string; label: string } | undefined {
  const v = (valor ?? "").trim().toLowerCase();
  return col.opciones?.find((o) => o.value.toLowerCase() === v || o.label.toLowerCase() === v);
}

/** Monto crudo → "U$ 1.300" para mostrar en la celda (vacío si no hay). */
export function montoParaMostrar(valor: string): string {
  const n = normalizarMonto(valor);
  return n === "" ? "" : fmtUsd(Number(n));
}
