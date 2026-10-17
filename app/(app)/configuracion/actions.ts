"use server";

import { revalidatePath } from "next/cache";
import {
  requireEscritura,
  requireRoleEscritura,
  inviteMember,
  setMemberRole,
  deactivateMember,
  setMemberEmail,
} from "@/lib/auth";
import type { AuthResult, Rol } from "@/lib/auth/types";
import { updateNegocio, uploadLogo, removeLogo, type Negocio } from "@/lib/db/configuracion";
import { createCelularesBulk, listImeisExistentes, type CelularInput } from "@/lib/db/inventario";
import { createNotebooksBulk, listSeriesExistentes } from "@/lib/db/notebooks";
import type { NotebookInput } from "@/lib/notebooks";
import { createClientesBulk, listClientesContacto } from "@/lib/db/clientes";
import {
  parseCelularRow,
  parseClienteRow,
  parseNotebookRow,
  marcarSerieDuplicadaEnArchivo,
  marcarImeiDuplicadoEnArchivo,
  marcarClienteDuplicadoEnArchivo,
  type ClienteImportInput,
} from "@/lib/importacion";

export async function inviteMemberAction(
  email: string,
  nombre: string,
  rol: Rol,
): Promise<AuthResult> {
  const result = await inviteMember({ email, nombre, rol });
  if (!result.error) revalidatePath("/configuracion");
  return result;
}

export async function setMemberRoleAction(
  targetProfileId: string,
  nuevoRol: Rol,
): Promise<AuthResult> {
  const result = await setMemberRole(targetProfileId, nuevoRol);
  if (!result.error) revalidatePath("/configuracion");
  return result;
}

export async function setMemberEmailAction(
  targetProfileId: string,
  nuevoEmail: string,
): Promise<AuthResult> {
  const result = await setMemberEmail(targetProfileId, nuevoEmail);
  if (!result.error) revalidatePath("/configuracion");
  return result;
}

export async function deactivateMemberAction(targetProfileId: string): Promise<AuthResult> {
  const result = await deactivateMember(targetProfileId);
  if (!result.error) revalidatePath("/configuracion");
  return result;
}

export async function updateNegocioAction(data: Negocio): Promise<void> {
  await requireEscritura();
  await updateNegocio(data);
  revalidatePath("/configuracion");
}

/** Upload del logo (FormData con `file`) -- flujo propio, no va con el
 * form de `updateNegocioAction`. */
export async function uploadLogoAction(formData: FormData): Promise<void> {
  const caller = await requireRoleEscritura("admin");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Elegí un archivo de imagen para el logo.");
  }
  await uploadLogo(caller.organizationId, file);
  revalidatePath("/configuracion");
}

export async function removeLogoAction(): Promise<void> {
  const caller = await requireRoleEscritura("admin");
  await removeLogo(caller.organizationId);
  revalidatePath("/configuracion");
}

// ─────────────────────── Importar datos ───────────────────────

export type ImportRowResult = {
  rowNum: number;
  status: "imported" | "duplicate" | "error";
  detail?: string;
};
export type ImportResult = {
  inserted: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
};

function ordenarResultado(
  inserted: number,
  results: ImportRowResult[],
): ImportResult {
  results.sort((a, b) => a.rowNum - b.rowNum);
  return {
    inserted,
    skipped: results.filter((r) => r.status === "duplicate").length,
    errors: results.filter((r) => r.status === "error").length,
    rows: results,
  };
}

/** Importación masiva de celulares existentes (CSV). Recibe filas CRUDAS
 * (no pre-parseadas) -- nunca confía en la validación hecha en el
 * navegador, revalida todo con el mismo schema del preview. Admin-only:
 * es una herramienta de carga de datos, no una operación normal de
 * Inventario. */
export async function importCelularesAction(
  rawRows: { rowNum: number; raw: Record<string, string> }[],
): Promise<ImportResult> {
  await requireRoleEscritura("admin");

  const results: ImportRowResult[] = [];
  const validos: { rowNum: number; data: CelularInput }[] = [];
  for (const { rowNum, raw } of rawRows) {
    const parsed = parseCelularRow(raw, rowNum);
    if (!parsed.ok) {
      results.push({ rowNum, status: "error", detail: parsed.error });
      continue;
    }
    validos.push({ rowNum, data: parsed.data });
  }

  const dupEnArchivo = marcarImeiDuplicadoEnArchivo(
    validos.map((v) => ({ rowNum: v.rowNum, imei: v.data.imei })),
  );
  const existentes = await listImeisExistentes();

  const aInsertar: CelularInput[] = [];
  const filasAInsertar: number[] = [];
  for (const v of validos) {
    if (dupEnArchivo.has(v.rowNum)) {
      results.push({ rowNum: v.rowNum, status: "duplicate", detail: dupEnArchivo.get(v.rowNum) });
      continue;
    }
    const imei = v.data.imei.trim();
    if (imei && existentes.has(imei)) {
      results.push({ rowNum: v.rowNum, status: "duplicate", detail: "IMEI ya existe en Inventario" });
      continue;
    }
    aInsertar.push(v.data);
    filasAInsertar.push(v.rowNum);
  }

  const { inserted } = await createCelularesBulk(aInsertar);
  filasAInsertar.forEach((rowNum) => results.push({ rowNum, status: "imported" }));

  if (inserted > 0) revalidatePath("/inventario");
  return ordenarResultado(inserted, results);
}

/** Importación masiva de notebooks existentes (CSV). Mismo criterio que
 * `importCelularesAction`, con el número de serie como clave de dedupe. */
export async function importNotebooksAction(
  rawRows: { rowNum: number; raw: Record<string, string> }[],
): Promise<ImportResult> {
  await requireRoleEscritura("admin");

  const results: ImportRowResult[] = [];
  const validos: { rowNum: number; data: NotebookInput }[] = [];
  for (const { rowNum, raw } of rawRows) {
    const parsed = parseNotebookRow(raw, rowNum);
    if (!parsed.ok) {
      results.push({ rowNum, status: "error", detail: parsed.error });
      continue;
    }
    validos.push({ rowNum, data: parsed.data });
  }

  const dupEnArchivo = marcarSerieDuplicadaEnArchivo(
    validos.map((v) => ({ rowNum: v.rowNum, numeroSerie: v.data.numeroSerie })),
  );
  const existentes = await listSeriesExistentes();

  const aInsertar: NotebookInput[] = [];
  const filasAInsertar: number[] = [];
  for (const v of validos) {
    if (dupEnArchivo.has(v.rowNum)) {
      results.push({ rowNum: v.rowNum, status: "duplicate", detail: dupEnArchivo.get(v.rowNum) });
      continue;
    }
    const serie = v.data.numeroSerie.trim();
    if (serie && existentes.has(serie)) {
      results.push({ rowNum: v.rowNum, status: "duplicate", detail: "Número de serie ya existe en Inventario" });
      continue;
    }
    aInsertar.push(v.data);
    filasAInsertar.push(v.rowNum);
  }

  const { inserted } = await createNotebooksBulk(aInsertar);
  filasAInsertar.forEach((rowNum) => results.push({ rowNum, status: "imported" }));

  if (inserted > 0) revalidatePath("/inventario");
  return ordenarResultado(inserted, results);
}

/** Importación masiva de clientes existentes (CSV). Mismo criterio que
 * `importCelularesAction`: revalida server-side, dedupe por teléfono/email
 * (archivo + clientes ya existentes), admin-only. */
export async function importClientesAction(
  rawRows: { rowNum: number; raw: Record<string, string> }[],
): Promise<ImportResult> {
  await requireRoleEscritura("admin");

  const results: ImportRowResult[] = [];
  const validos: { rowNum: number; data: ClienteImportInput }[] = [];
  for (const { rowNum, raw } of rawRows) {
    const parsed = parseClienteRow(raw, rowNum);
    if (!parsed.ok) {
      results.push({ rowNum, status: "error", detail: parsed.error });
      continue;
    }
    validos.push({ rowNum, data: parsed.data });
  }

  const dupEnArchivo = marcarClienteDuplicadoEnArchivo(
    validos.map((v) => ({ rowNum: v.rowNum, telefono: v.data.telefono, email: v.data.email })),
  );
  const existentes = await listClientesContacto();
  const clavesExistentes = new Set(
    existentes.flatMap((c) => [c.telefono.trim().toLowerCase(), c.email.trim().toLowerCase()].filter(Boolean)),
  );

  const aInsertar: ClienteImportInput[] = [];
  const filasAInsertar: number[] = [];
  for (const v of validos) {
    if (dupEnArchivo.has(v.rowNum)) {
      results.push({ rowNum: v.rowNum, status: "duplicate", detail: dupEnArchivo.get(v.rowNum) });
      continue;
    }
    const claves = [v.data.telefono.trim().toLowerCase(), v.data.email.trim().toLowerCase()].filter(
      Boolean,
    );
    if (claves.some((k) => clavesExistentes.has(k))) {
      results.push({
        rowNum: v.rowNum,
        status: "duplicate",
        detail: "Ya existe un cliente con ese teléfono o email",
      });
      continue;
    }
    aInsertar.push(v.data);
    filasAInsertar.push(v.rowNum);
  }

  const { inserted } = await createClientesBulk(aInsertar);
  filasAInsertar.forEach((rowNum) => results.push({ rowNum, status: "imported" }));

  if (inserted > 0) revalidatePath("/clientes");
  return ordenarResultado(inserted, results);
}
