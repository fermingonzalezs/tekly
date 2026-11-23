import "server-only";
import { createServerClient, createServiceRoleClient } from "@/lib/auth/supabase";
import { ENTIDADES_IMPORTACION, type EntidadImportacion } from "@/lib/ia-lecturas";

/** Lecturas con IA hechas por la organización, por tipo (RLS acota a la org). */
export async function lecturasIaUsadas(): Promise<Record<EntidadImportacion, number>> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("ia_lecturas").select("entidad");
  if (error) throw error;
  const usadas = Object.fromEntries(ENTIDADES_IMPORTACION.map((e) => [e, 0])) as Record<
    EntidadImportacion,
    number
  >;
  for (const fila of data) usadas[fila.entidad as EntidadImportacion] += 1;
  return usadas;
}

/** Filas que devolvió la última lectura de ese tipo, para retomarla. */
export async function ultimaLecturaIa(
  entidad: EntidadImportacion,
): Promise<Record<string, string>[] | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("ia_lecturas")
    .select("filas_resultado")
    .eq("entidad", entidad)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.filas_resultado as Record<string, string>[] | undefined) ?? null;
}

/** Solo service role escribe la tabla, con la org explícita. */
export async function registrarLecturaIa(params: {
  organizationId: string;
  usuarioId: string;
  entidad: EntidadImportacion;
  filas: Record<string, string>[];
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service.from("ia_lecturas").insert({
    organization_id: params.organizationId,
    usuario_id: params.usuarioId,
    entidad: params.entidad,
    filas: params.filas.length,
    filas_resultado: params.filas,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
  });
  if (error) throw error;
}
