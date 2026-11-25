"use server";

import { revalidatePath } from "next/cache";
import {
  requireEscritura,
  requireRoleEscritura,
  inviteMember,
  setMemberInstagram,
  setMemberRoles,
  deactivateMember,
  reactivateMember,
  resendInvite,
  deleteMember,
  getHistorialMember,
  setMemberEmail,
} from "@/lib/auth";
import type { AuthResult, Rol } from "@/lib/auth/types";
import { updateNegocio, uploadLogo, removeLogo, type Negocio } from "@/lib/db/configuracion";
import { createCelularesBulk, listImeisExistentes, type CelularInput } from "@/lib/db/inventario";
import { listVariantes } from "@/lib/db/variantes";
import { createNotebooksBulk, listSeriesExistentes } from "@/lib/db/notebooks";
import type { NotebookInput } from "@/lib/notebooks";
import { createClientesBulk, listClientesContacto } from "@/lib/db/clientes";
import {
  lecturasIaIlimitadas,
  lecturasIaUsadas,
  registrarLecturaIa,
  ultimaLecturaIa,
} from "@/lib/db/ia-lecturas";
import { estructurarTextoConIa } from "@/lib/ia/importacion";
import {
  ENTIDADES_IMPORTACION,
  lecturasRestantes,
  validarTextoIa,
  type EntidadImportacion,
} from "@/lib/ia-lecturas";
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
  roles: Rol[],
): Promise<AuthResult> {
  const result = await inviteMember({ email, nombre, roles });
  if (!result.error) revalidatePath("/configuracion");
  return result;
}

/** Cambia los roles de un miembro (plan 029). La RPC valida admin, misma org y
 * que no quede la organización sin ningún admin activo. */
export async function setMemberRolesAction(
  targetProfileId: string,
  roles: Rol[],
): Promise<AuthResult> {
  const result = await setMemberRoles(targetProfileId, roles);
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

export async function reactivateMemberAction(targetProfileId: string): Promise<AuthResult> {
  const result = await reactivateMember(targetProfileId);
  if (!result.error) revalidatePath("/configuracion");
  return result;
}

export async function resendInviteAction(targetProfileId: string): Promise<AuthResult> {
  return resendInvite(targetProfileId);
}

/** Borrado real: solo si el miembro no tiene historial (lo revalida adentro). */
export async function deleteMemberAction(targetProfileId: string): Promise<AuthResult> {
  const result = await deleteMember(targetProfileId);
  if (!result.error) revalidatePath("/configuracion");
  return result;
}

/** Solo lectura: decide si el dialog ofrece «Eliminar» o «Desactivar». */
export async function getHistorialMemberAction(targetProfileId: string) {
  return getHistorialMember(targetProfileId);
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
  // La variante viene de la tabla de revisión: se revalida contra la org.
  const variantesValidas = new Set(
    (await listVariantes({ incluirInactivas: true })).map((v) => v.id),
  );
  for (const { rowNum, raw } of rawRows) {
    const parsed = parseCelularRow(raw, rowNum);
    if (!parsed.ok) {
      results.push({ rowNum, status: "error", detail: parsed.error });
      continue;
    }
    if (!variantesValidas.has(parsed.data.varianteId)) {
      results.push({ rowNum, status: "error", detail: "La variante elegida no existe" });
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
  const variantesValidas = new Set(
    (await listVariantes({ incluirInactivas: true, categoria: "notebook" })).map((v) => v.id),
  );
  for (const { rowNum, raw } of rawRows) {
    const parsed = parseNotebookRow(raw, rowNum);
    if (!parsed.ok) {
      results.push({ rowNum, status: "error", detail: parsed.error });
      continue;
    }
    if (!variantesValidas.has(parsed.data.varianteId)) {
      results.push({ rowNum, status: "error", detail: "La variante elegida no existe" });
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

// ─────────────────────── Leer con IA ───────────────────────

export type LecturaIaResult =
  | { ok: true; filas: Record<string, string>[]; restantes: number }
  | { ok: false; error: string; restantes: number };

/** Estructura texto pegado con IA y devuelve filas crudas con las columnas de
 * la plantilla; el cliente las muestra en la tabla editable (mismo preview que
 * un CSV) y recién se guardan con `import*Action`. Una lectura por tipo: solo
 * cuenta una que salió bien, y su resultado queda guardado para retomarlo. */
export async function leerConIaAction(
  entidad: EntidadImportacion,
  texto: string,
): Promise<LecturaIaResult> {
  const user = await requireRoleEscritura("admin");
  if (!ENTIDADES_IMPORTACION.includes(entidad)) {
    return { ok: false, error: "Tipo de importación inválido.", restantes: 0 };
  }
  const [usadas, iaIlimitadas] = await Promise.all([lecturasIaUsadas(), lecturasIaIlimitadas()]);
  const restantes = lecturasRestantes(usadas[entidad], iaIlimitadas);
  if (restantes === 0) {
    return {
      ok: false,
      error: "Ya usaste la lectura con IA de este tipo. Podés retomarla o importar con la plantilla.",
      restantes,
    };
  }
  const errorTexto = validarTextoIa(texto);
  if (errorTexto) return { ok: false, error: errorTexto, restantes };

  const lectura = await estructurarTextoConIa(entidad, texto.trim());
  if (!lectura.ok) return { ok: false, error: lectura.error, restantes };
  if (lectura.filas.length === 0) {
    return { ok: false, error: "No se encontraron datos para importar en el texto.", restantes };
  }

  await registrarLecturaIa({
    organizationId: user.organizationId,
    usuarioId: user.id,
    entidad,
    filas: lectura.filas,
    inputTokens: lectura.inputTokens,
    outputTokens: lectura.outputTokens,
  });
  return { ok: true, filas: lectura.filas, restantes: restantes - 1 };
}

/** Vuelve a cargar el resultado de la lectura ya hecha (no gasta nada). */
export async function retomarLecturaIaAction(
  entidad: EntidadImportacion,
): Promise<Record<string, string>[] | null> {
  await requireRoleEscritura("admin");
  if (!ENTIDADES_IMPORTACION.includes(entidad)) return null;
  return ultimaLecturaIa(entidad);
}

export async function setMemberInstagramAction(
  targetProfileId: string,
  instagram: string,
): Promise<AuthResult> {
  const result = await setMemberInstagram(targetProfileId, instagram);
  if (!result.error) revalidatePath("/configuracion");
  return result;
}
