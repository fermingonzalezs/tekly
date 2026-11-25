// Lógica pura de la Agenda (Turnos): fechas como strings `YYYY-MM-DD` con
// aritmética de calendario (nunca `new Date(iso)` ni `toISOString()` sobre
// una fecha local). Portado de `agendaUtils.js` de sistema-update.
import { sumarDias } from "@/lib/date-presets";
import type { Pedido, Turno, TurnoTipo } from "@/lib/types";

export type VistaAgenda = "semana" | "mes";
export const VISTAS_AGENDA: VistaAgenda[] = ["semana", "mes"];

/** Horario de la grilla. */
export const HORA_INICIO = 9;
export const HORA_FIN = 20;
export const PX_POR_HORA = 56;
/** Duración por defecto si un turno no la trae. */
export const DURACION_DEFAULT = 30;
/** Duración sugerida por motivo (editable en el form). */
export const DURACION_POR_TIPO: Record<TurnoTipo, number> = {
  compra: 30,
  deja: 30,
  retira: 30,
  cotizar: 30,
};
export const DURACIONES = [15, 30, 45, 60, 90] as const;

/** Cantidad de días de la semana visible: 6 = lunes a sábado. Un negocio
 * que abre domingos sube esto a 7 (ver `semanaDe`). */
export const DIAS_SEMANA_AGENDA = 6;

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function horaAMinutos(hora: string): number {
  const [h, m] = (hora || "0:0").split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutosAHora(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Hora de fin (`HH:MM`) de un turno que arranca en `hora` y dura `duracionMin`. */
export function horaFin(hora: string, duracionMin: number): string {
  return minutosAHora(horaAMinutos(hora) + duracionMin);
}

/** Todos los pasos de media hora entre `HORA_INICIO` y `HORA_FIN` (último = 19:30). */
export const HORAS_MEDIA: string[] = Array.from(
  { length: (HORA_FIN - HORA_INICIO) * 2 },
  (_, i) => minutosAHora(HORA_INICIO * 60 + i * 30),
);

const esFechaValida = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/** 0 = domingo … 6 = sábado. */
export function diaDeSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Lunes a sábado de la semana de `fecha`. Un domingo muestra la semana siguiente. */
export function semanaDe(fecha: string): string[] {
  const dia = diaDeSemana(fecha);
  const desdeLunes = dia === 0 ? -1 : dia - 1;
  const lunes = sumarDias(fecha, -desdeLunes);
  return Array.from({ length: DIAS_SEMANA_AGENDA }, (_, i) => sumarDias(lunes, i));
}

/** Primer día del mes de `fecha`. */
const primeroDelMes = (fecha: string) => `${fecha.slice(0, 7)}-01`;

/** Semanas (lunes a sábado) que cubren el mes de `fecha`, con los días de
 * los meses vecinos que completan la primera y la última. */
export function semanasDelMes(fecha: string): string[][] {
  const primero = primeroDelMes(fecha);
  const siguiente = moverMes(primero, 1);
  const ultimo = sumarDias(siguiente, -1);
  const semanas: string[][] = [];
  let cursor = primero;
  // El 1º puede caer domingo: `semanaDe` salta a la semana siguiente, y ese
  // domingo no se dibuja (la grilla es lunes a sábado).
  while (cursor <= ultimo) {
    const sem = semanaDe(cursor);
    if (!semanas.length || semanas[semanas.length - 1][0] !== sem[0]) semanas.push(sem);
    cursor = sumarDias(sem[0], 7);
  }
  return semanas;
}

function moverMes(fecha: string, delta: number): string {
  const [y, m] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + delta, 1));
  return t.toISOString().slice(0, 10);
}

/** Rango de fechas (ambos incluidos) que hay que traer para dibujar la vista. */
export function rangoDeVista(vista: VistaAgenda, fecha: string): { desde: string; hasta: string } {
  if (vista === "semana") {
    const s = semanaDe(fecha);
    return { desde: s[0], hasta: s[s.length - 1] };
  }
  const semanas = semanasDelMes(fecha);
  const ult = semanas[semanas.length - 1];
  return { desde: semanas[0][0], hasta: ult[ult.length - 1] };
}

/** ‹ / › de la barra de navegación. Mes → día 1 del mes vecino. */
export function moverFecha(vista: VistaAgenda, fecha: string, direccion: 1 | -1): string {
  if (vista === "semana") return sumarDias(fecha, 7 * direccion);
  return moverMes(primeroDelMes(fecha), direccion);
}

const ddmm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/** "23 al 28 de noviembre" · "30 de noviembre al 5 de diciembre" · "Noviembre de 2026". */
export function etiquetaRango(vista: VistaAgenda, fecha: string): string {
  const dia = (f: string) => Number(f.slice(8, 10));
  const mes = (f: string) => MESES[Number(f.slice(5, 7)) - 1].toLowerCase();
  if (vista === "semana") {
    const s = semanaDe(fecha);
    const [ini, fin] = [s[0], s[s.length - 1]];
    return mes(ini) === mes(fin)
      ? `${dia(ini)} al ${dia(fin)} de ${mes(fin)}`
      : `${dia(ini)} de ${mes(ini)} al ${dia(fin)} de ${mes(fin)}`;
  }
  return `${MESES[Number(fecha.slice(5, 7)) - 1]} de ${fecha.slice(0, 4)}`;
}

export const diaCorto = (fecha: string) => DIAS_CORTOS[diaDeSemana(fecha)];
export const fechaCorta = (fecha: string) => ddmm(fecha);
export const etiquetaDia = (fecha: string) => `${diaCorto(fecha)} ${ddmm(fecha)}`;

// ── Filtros (la URL manda) ──────────────────────────────────────

export type FiltrosAgenda = { vista: VistaAgenda; fecha: string };

type SP = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** `?vista=semana|mes&fecha=YYYY-MM-DD`; inválido → semana + hoy. */
export function parseFiltrosAgenda(sp: SP, hoy: string): FiltrosAgenda {
  const v = uno(sp.vista);
  const f = uno(sp.fecha);
  return {
    vista: (VISTAS_AGENDA as string[]).includes(v ?? "") ? (v as VistaAgenda) : "semana",
    fecha: esFechaValida(f) ? f : hoy,
  };
}

// ── Turnos: estado, solapes, próximos ───────────────────────────

type ConHorario = { hora: string; duracionMin: number };

const fin = (e: ConHorario) => horaAMinutos(e.hora) + (e.duracionMin || DURACION_DEFAULT);

/** Un turno "abierto" todavía no se marcó como atendido/no vino/cancelado. */
export const estaAbierto = (t: Pick<Turno, "estado">) =>
  t.estado === "pendiente" || t.estado === "confirmado";

/** Pasado y sin marcar. */
export const esVencido = (t: Pick<Turno, "estado" | "fecha">, hoy: string) =>
  t.fecha < hoy && estaAbierto(t);

/** Para turnos con hora de un mismo día: asigna `col`/`cols` y los
 * superpuestos se reparten el ancho en partes iguales. */
export function calcularSolapes<T extends ConHorario>(
  delDia: T[],
): { evento: T; col: number; cols: number }[] {
  const ordenados = [...delDia].sort(
    (a, b) => horaAMinutos(a.hora) - horaAMinutos(b.hora) || fin(b) - fin(a),
  );
  const resultado: { evento: T; col: number; cols: number }[] = [];
  let grupo: { evento: T; col: number }[] = [];
  let finGrupo = -1;
  const finColumna: number[] = [];
  const cerrar = () => {
    const cols = Math.max(1, ...grupo.map((g) => g.col + 1));
    grupo.forEach((g) => resultado.push({ evento: g.evento, col: g.col, cols }));
    grupo = [];
    finGrupo = -1;
  };
  for (const evento of ordenados) {
    const inicio = horaAMinutos(evento.hora);
    if (grupo.length > 0 && inicio >= finGrupo) {
      cerrar();
      finColumna.length = 0;
    }
    let col = finColumna.findIndex((f) => f <= inicio);
    if (col === -1) col = finColumna.length;
    finColumna[col] = fin(evento);
    grupo.push({ evento, col });
    finGrupo = Math.max(finGrupo, fin(evento));
  }
  if (grupo.length > 0) cerrar();
  return resultado;
}

/** Grupos de turnos que se pisan entre sí (en orden de inicio). Uno suelto es un grupo de 1. */
export function agruparSolapados<T extends ConHorario>(eventos: T[]): T[][] {
  const ordenados = [...eventos].sort((a, b) => horaAMinutos(a.hora) - horaAMinutos(b.hora));
  const grupos: T[][] = [];
  let finGrupo = -1;
  for (const e of ordenados) {
    if (grupos.length > 0 && horaAMinutos(e.hora) < finGrupo) {
      grupos[grupos.length - 1].push(e);
      finGrupo = Math.max(finGrupo, fin(e));
    } else {
      grupos.push([e]);
      finGrupo = fin(e);
    }
  }
  return grupos;
}

/** Entrada del panel «Próximos»: un turno abierto o un pedido sin entregar. */
export type ItemProximo<T, P> =
  | { clase: "turno"; id: string; fecha: string; hora: string; turno: T }
  | { clase: "pedido"; id: string; fecha: string; hora: string; pedido: P };

export type GrupoProximos<T, P = Pedido> = {
  clave: "atrasados" | "hoy" | "manana" | "semana" | "despues";
  label: string;
  items: ItemProximo<T, P>[];
};

// Los pedidos no tienen hora: `hora = ""` los pone primero en su día («Todo el día»).
const porFechaHora = (a: { fecha: string; hora: string }, b: { fecha: string; hora: string }) =>
  a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora);

/** Atrasados (pasaron sin cerrarse, el más viejo primero) / Hoy / Mañana /
 * Esta semana / Más adelante. Turnos abiertos + pedidos sin entregar ni
 * cancelar, mezclados por fecha; los grupos vacíos se omiten. */
export function agruparProximos<
  T extends Pick<Turno, "id" | "fecha" | "hora" | "estado">,
  P extends Pick<Pedido, "id" | "fechaEntrega" | "estado"> = Pedido,
>(turnos: T[], hoy: string, pedidos: P[] = []): GrupoProximos<T, P>[] {
  const manana = sumarDias(hoy, 1);
  const sem = semanaDe(hoy);
  const finSemana = sem[sem.length - 1];
  const items: ItemProximo<T, P>[] = [
    ...turnos
      .filter(estaAbierto)
      .map((t) => ({ clase: "turno" as const, id: t.id, fecha: t.fecha, hora: t.hora, turno: t })),
    ...[...new Map(pedidos.map((p) => [p.id, p])).values()]
      .filter((p) => p.estado === "pedido" || p.estado === "llego")
      .map((p) => ({ clase: "pedido" as const, id: p.id, fecha: p.fechaEntrega, hora: "", pedido: p })),
  ].sort(porFechaHora);
  const grupos: GrupoProximos<T, P>[] = [
    { clave: "atrasados", label: "Atrasados", items: [] },
    { clave: "hoy", label: "Hoy", items: [] },
    { clave: "manana", label: "Mañana", items: [] },
    { clave: "semana", label: "Esta semana", items: [] },
    { clave: "despues", label: "Más adelante", items: [] },
  ];
  for (const it of items) {
    const g =
      it.fecha < hoy ? 0 : it.fecha === hoy ? 1 : it.fecha === manana ? 2 : it.fecha <= finSemana ? 3 : 4;
    grupos[g].items.push(it);
  }
  return grupos.filter((g) => g.items.length > 0);
}

/** Turnos activos de la misma persona que pisan el horario dado. */
export function turnosSuperpuestos<
  T extends Pick<Turno, "id" | "fecha" | "hora" | "duracionMin" | "estado" | "atiendeId">,
>(
  turnos: T[],
  atiendeId: string | null,
  fecha: string,
  hora: string,
  duracionMin: number,
  excluirId: string | null = null,
): T[] {
  if (!atiendeId || !fecha || !hora) return [];
  const ini = horaAMinutos(hora);
  const fn = ini + (Number(duracionMin) || DURACION_DEFAULT);
  return turnos.filter((t) => {
    if (t.id === excluirId || t.atiendeId !== atiendeId || t.fecha !== fecha) return false;
    if (t.estado === "cancelado" || t.estado === "no_vino") return false;
    const tIni = horaAMinutos(t.hora);
    return ini < tIni + (t.duracionMin || DURACION_DEFAULT) && tIni < fn;
  });
}

export type KpisAgenda = {
  /** Lo que hay que atender hoy: turnos (sin cancelados) + pedidos abiertos que se entregan hoy. */
  hoy: { turnos: number; pedidos: number };
  /** Pedidos sin entregar ni cancelar, de cualquier fecha. */
  pedidosPendientes: number;
  vencidos: { turnos: number; pedidos: number };
  /** Turnos marcados atendidos en los últimos 7 días (hoy incluido). */
  atendidosSemana: number;
};

/** KPIs de arriba. `turnos` = la mezcla de rango visible + próximos y
 * `pedidos` = abiertos + rango visible (se deduplica por id en los dos). */
export function kpisAgenda(turnos: Turno[], pedidos: Pedido[], hoy: string): KpisAgenda {
  const ts = [...new Map(turnos.map((t) => [t.id, t])).values()];
  const ps = [...new Map(pedidos.map((p) => [p.id, p])).values()];
  const abiertos = ps.filter(pedidoAbierto);
  const haceUnaSemana = sumarDias(hoy, -6);
  return {
    hoy: {
      turnos: ts.filter((t) => t.fecha === hoy && t.estado !== "cancelado").length,
      pedidos: abiertos.filter((p) => p.fechaEntrega === hoy).length,
    },
    pedidosPendientes: abiertos.length,
    vencidos: {
      turnos: ts.filter((t) => esVencido(t, hoy)).length,
      pedidos: ps.filter((p) => pedidoVencido(p, hoy)).length,
    },
    atendidosSemana: ts.filter(
      (t) => t.estado === "atendido" && t.fecha >= haceUnaSemana && t.fecha <= hoy,
    ).length,
  };
}

// ── Pedidos (fila «Todo el día») ────────────────────────────────

/** Un pedido sigue abierto mientras no se entregó ni se canceló. */
export const pedidoAbierto = (p: Pedido): boolean =>
  p.estado === "pedido" || p.estado === "llego";

/** Abierto con la fecha de entrega ya pasada. */
export const pedidoVencido = (p: Pedido, hoy: string): boolean =>
  pedidoAbierto(p) && p.fechaEntrega < hoy;

const ORDEN_PEDIDO: Record<Pedido["estado"], number> = {
  llego: 0,
  pedido: 1,
  entregado: 2,
  cancelado: 3,
};

/** Pedidos con entrega en `fecha`: primero los que llegaron (listos para
 * entregar), después los pedidos, y al final entregados/cancelados. */
export function pedidosDelDia(
  pedidos: Pedido[],
  fecha: string,
  { conCancelados = true }: { conCancelados?: boolean } = {},
): Pedido[] {
  return pedidos
    .filter((p) => p.fechaEntrega === fecha && (conCancelados || p.estado !== "cancelado"))
    .sort(
      (a, b) =>
        ORDEN_PEDIDO[a.estado] - ORDEN_PEDIDO[b.estado] || a.cliente.localeCompare(b.cliente),
    );
}
