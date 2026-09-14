import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import type { Cliente } from "@/lib/types";
import { fmtMonthYear } from "@/lib/format";
import { demografiaClientes as demografiaClientesPura, type Periodo, type RangoEdad } from "@/lib/clientes";

type ClienteRow = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  desde: string;
  fecha_nacimiento: string | null;
};

/** compras/reparaciones/gastadoUsd no se guardan en la tabla -- se derivan
 * acá mismo, contra ventas/tickets, para que nunca puedan desincronizarse
 * del dato real (ver comentario en la migración de schema). */
function toCliente(
  row: ClienteRow,
  stats: { compras: number; reparaciones: number; gastadoUsd: number },
): Cliente {
  return {
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono ?? "—",
    email: row.email ?? "—",
    desde: fmtMonthYear(row.desde),
    fechaNacimiento: row.fecha_nacimiento ?? undefined,
    compras: stats.compras,
    reparaciones: stats.reparaciones,
    gastadoUsd: stats.gastadoUsd,
  };
}

export async function listClientes(): Promise<Cliente[]> {
  const supabase = createServerClient();
  const { data: rows, error } = await supabase
    .from("clientes")
    .select("id, nombre, telefono, email, desde, fecha_nacimiento")
    .order("desde", { ascending: false });
  if (error) throw error;
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const [{ data: ventasPorCliente }, { data: ticketsPorCliente }] = await Promise.all([
    supabase.from("ventas").select("cliente_id, total_usd").in("cliente_id", ids),
    supabase.from("tickets").select("cliente_id").in("cliente_id", ids),
  ]);

  const statsPorId = new Map<string, { compras: number; reparaciones: number; gastadoUsd: number }>();
  for (const id of ids) statsPorId.set(id, { compras: 0, reparaciones: 0, gastadoUsd: 0 });
  for (const v of ventasPorCliente ?? []) {
    if (!v.cliente_id) continue;
    const s = statsPorId.get(v.cliente_id)!;
    s.compras += 1;
    s.gastadoUsd += v.total_usd;
  }
  for (const t of ticketsPorCliente ?? []) {
    if (!t.cliente_id) continue;
    statsPorId.get(t.cliente_id)!.reparaciones += 1;
  }

  return rows.map((r) => toCliente(r, statsPorId.get(r.id)!));
}

/** Lista liviana para selectores (Nuevo ticket, Nueva venta, …) -- sin las
 * queries de stats que hace `listClientes`. `telefono` es opcional para
 * quien no lo necesite (ej. el buscador de "Nueva venta" lo muestra). */
export async function listClientesOpciones(): Promise<
  { id: string; nombre: string; telefono: string }[]
> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, telefono")
    .order("nombre");
  if (error) throw error;
  return data.map((c) => ({ id: c.id, nombre: c.nombre, telefono: c.telefono ?? "—" }));
}

export async function createCliente(data: {
  nombre: string;
  telefono?: string;
  email?: string;
  fechaNacimiento?: string;
}): Promise<Cliente> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("clientes")
    .insert({
      nombre: data.nombre,
      telefono: data.telefono || null,
      email: data.email || null,
      fecha_nacimiento: data.fechaNacimiento || null,
    })
    .select("id, nombre, telefono, email, desde, fecha_nacimiento")
    .single();
  if (error) throw error;
  return toCliente(row, { compras: 0, reparaciones: 0, gastadoUsd: 0 });
}

/** Demografía por edad real, para el widget de Clientes. Clientes sin
 * `fecha_nacimiento` cargada quedan afuera del cálculo. */
export async function demografiaClientes(): Promise<Record<Periodo, RangoEdad[]>> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("fecha_nacimiento, desde")
    .not("fecha_nacimiento", "is", null);
  if (error) throw error;
  return demografiaClientesPura(
    data.map((c) => ({
      fechaNacimiento: c.fecha_nacimiento ?? undefined,
      desdeISO: c.desde,
    })),
  );
}

export type HistorialEntry =
  | { tipo: "venta"; id: string; fechaISO: string; detalle: string; montoUsd: number }
  | { tipo: "reparacion"; id: number; fechaISO: string; detalle: string; estado: string; montoUsd: number | null }
  | { tipo: "turno"; id: string; fechaISO: string; detalle: string; estado: string };

/** Historial cruzado de un cliente -- ventas, tickets y turnos reales.
 * Vacío hasta que esas secciones se migren de mock a datos reales (las
 * tablas ya existen desde la Fase 0, solo faltan las páginas que escriben
 * en ellas). */
export async function clienteHistorial(clienteId: string): Promise<HistorialEntry[]> {
  const supabase = createServerClient();
  const [{ data: ventas }, { data: tickets }, { data: turnos }] = await Promise.all([
    supabase
      .from("ventas")
      .select("id, fecha, items, total_usd")
      .eq("cliente_id", clienteId),
    supabase
      .from("tickets")
      .select("id, ingreso, equipo, falla, estado, presupuesto_usd")
      .eq("cliente_id", clienteId),
    supabase
      .from("turnos")
      .select("id, fecha, hora, tipo, estado")
      .eq("cliente_id", clienteId),
  ]);

  const entries: HistorialEntry[] = [
    ...(ventas ?? []).map((v): HistorialEntry => ({
      tipo: "venta",
      id: v.id,
      fechaISO: v.fecha,
      detalle: Array.isArray(v.items)
        ? (v.items as { detalle: string }[]).map((i) => i.detalle).join(" · ")
        : "",
      montoUsd: v.total_usd,
    })),
    ...(tickets ?? []).map((t): HistorialEntry => ({
      tipo: "reparacion",
      id: t.id,
      fechaISO: t.ingreso,
      detalle: `${t.equipo} · ${t.falla ?? ""}`,
      estado: t.estado,
      montoUsd: t.presupuesto_usd || null,
    })),
    ...(turnos ?? []).map((t): HistorialEntry => ({
      tipo: "turno",
      id: t.id,
      fechaISO: `${t.fecha}T${t.hora}`,
      detalle: t.tipo,
      estado: t.estado,
    })),
  ];

  return entries.sort(
    (a, b) => new Date(b.fechaISO).getTime() - new Date(a.fechaISO).getTime(),
  );
}
