// Reglas puras de la administración de usuarios (Configuración → Usuarios):
// qué acciones se ofrecen según el estado del miembro, y qué tablas cuentan
// como "historial" que impide borrarlo de verdad. Sin Supabase.

/** Tablas que referencian `profiles.id` **sin** cascada (`on delete no
 * action`): si el usuario tiene una fila en alguna, borrarlo rompería la FK,
 * así que solo se puede desactivar. `turnos.atiende_id` e
 * `ia_lecturas.usuario_id` son `on delete set null` y no bloquean. Si se
 * agrega una FK nueva a `profiles` sin cascada, sumarla acá. */
export const HISTORIAL_USUARIO = [
  { tabla: "ventas", columna: "vendedor_id", singular: "venta", plural: "ventas" },
  { tabla: "tickets", columna: "tecnico_id", singular: "ticket asignado", plural: "tickets asignados" },
  { tabla: "movimientos_caja", columna: "usuario_id", singular: "movimiento de caja", plural: "movimientos de caja" },
  { tabla: "movimientos_cc", columna: "usuario_id", singular: "movimiento de cuenta corriente", plural: "movimientos de cuenta corriente" },
  { tabla: "movimientos_stock", columna: "usuario_id", singular: "movimiento de stock", plural: "movimientos de stock" },
  { tabla: "conciliaciones", columna: "responsable_id", singular: "conciliación", plural: "conciliaciones" },
  { tabla: "recuentos_stock", columna: "responsable_id", singular: "recuento", plural: "recuentos" },
  { tabla: "recuentos_stock", columna: "revisado_por_id", singular: "recuento revisado", plural: "recuentos revisados" },
  { tabla: "reportes_bugs", columna: "usuario_id", singular: "reporte de error", plural: "reportes de error" },
] as const;

export type ConteoHistorial = { singular: string; plural: string; cantidad: number };

/** "3 ventas y 1 ticket asignado" — solo lo que tiene filas. `""` si nada. */
export function resumenHistorial(conteos: ConteoHistorial[]): string {
  const partes = conteos
    .filter((c) => c.cantidad > 0)
    .map((c) => `${c.cantidad} ${c.cantidad === 1 ? c.singular : c.plural}`);
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

export type EstadoMiembro = "activo" | "pendiente" | "inactivo";

/** `pendiente` = activo pero todavía no aceptó la invitación (no confirmó el
 * email). Un inactivo es inactivo aunque nunca haya entrado. */
export function estadoMiembro(m: { activo: boolean; pendiente: boolean }): EstadoMiembro {
  if (!m.activo) return "inactivo";
  return m.pendiente ? "pendiente" : "activo";
}

export type AccionesMiembro = {
  reenviarInvitacion: boolean;
  reactivar: boolean;
  /** Borrado real (cuenta + perfil): solo sin historial. */
  eliminar: boolean;
  /** Baja lógica: cuando tiene historial y sigue activo. */
  desactivar: boolean;
};

/** Qué botones ofrece el dialog de un miembro. `tieneHistorial` es
 * `undefined` mientras se consulta: hasta saberlo no se ofrece ni eliminar
 * ni desactivar (para no mostrar el botón equivocado). Uno mismo no tiene
 * acciones (el server lo rechaza igual). */
export function accionesMiembro(m: {
  activo: boolean;
  pendiente: boolean;
  tieneHistorial: boolean | undefined;
  esUnoMismo: boolean;
}): AccionesMiembro {
  const ninguna = { reenviarInvitacion: false, reactivar: false, eliminar: false, desactivar: false };
  if (m.esUnoMismo) return ninguna;
  const conocido = m.tieneHistorial !== undefined;
  return {
    reenviarInvitacion: m.activo && m.pendiente,
    reactivar: !m.activo,
    eliminar: conocido && !m.tieneHistorial,
    desactivar: conocido && !!m.tieneHistorial && m.activo,
  };
}
