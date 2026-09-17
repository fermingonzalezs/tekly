import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { fmtDayMonth, fmtTime } from "@/lib/format";
import type { Servicio, Ticket, TicketServicio, TicketStatus } from "@/lib/types";

// ─────────────────────────── Tickets ───────────────────────────

type TicketRow = {
  id: number;
  cliente_id: string | null;
  clientes: { nombre: string } | null;
  equipo: string;
  imei: string | null;
  falla: string | null;
  tecnico_id: string | null;
  profiles: { nombre: string } | null;
  estado: TicketStatus;
  ingreso: string;
  presupuesto_usd: number;
  servicios: TicketServicio[];
  nota: string | null;
};

const TICKET_COLS =
  "id, cliente_id, clientes(nombre), equipo, imei, falla, tecnico_id, profiles(nombre), estado, ingreso, presupuesto_usd, servicios, nota";

function toTicket(row: TicketRow): Ticket {
  const ingreso = new Date(row.ingreso);
  return {
    id: row.id,
    clienteId: row.cliente_id ?? "",
    cliente: row.clientes?.nombre ?? "—",
    equipo: row.equipo,
    imei: row.imei ?? "—",
    falla: row.falla ?? "",
    tecnicoId: row.tecnico_id,
    tecnico: row.profiles?.nombre ?? null,
    estado: row.estado,
    ingreso: `${fmtDayMonth(row.ingreso)} ${fmtTime(row.ingreso)}`,
    fechaISO: ingreso.toISOString().slice(0, 10),
    presupuestoUsd: row.presupuesto_usd,
    servicios: row.servicios ?? [],
    nota: row.nota ?? undefined,
  };
}

export async function listTickets(): Promise<Ticket[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("tickets")
    .select(TICKET_COLS)
    .order("ingreso", { ascending: false });
  if (error) throw error;
  return (data as unknown as TicketRow[]).map(toTicket);
}

export async function createTicket(data: {
  clienteId: string;
  equipo: string;
  falla: string;
  tecnicoId: string | null;
}): Promise<Ticket> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("tickets")
    .insert({
      cliente_id: data.clienteId,
      equipo: data.equipo,
      falla: data.falla,
      tecnico_id: data.tecnicoId,
      estado: "recibido" satisfies TicketStatus,
      servicios: [],
    })
    .select(TICKET_COLS)
    .single();
  if (error) throw error;
  return toTicket(row as unknown as TicketRow);
}

export async function setTicketEstado(id: number, estado: TicketStatus): Promise<Ticket> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("tickets")
    .update({ estado })
    .eq("id", id)
    .select(TICKET_COLS)
    .single();
  if (error) throw error;
  return toTicket(row as unknown as TicketRow);
}

/** Un turno puede referenciar el ticket (`turnos.ticket_id`, ej. "retira
 * reparación" vinculado) -- el FK es `NO ACTION`, así que hay que
 * desvincularlo antes de poder borrar el ticket. */
export async function deleteTicket(id: number): Promise<void> {
  const supabase = createServerClient();

  const { error: unlinkError } = await supabase
    .from("turnos")
    .update({ ticket_id: null })
    .eq("ticket_id", id);
  if (unlinkError) throw unlinkError;

  const { error } = await supabase.from("tickets").delete().eq("id", id);
  if (error) throw error;
}

// ─────────────────────────── Técnicos ───────────────────────────

/** No hay tabla de "técnicos" separada -- son los `profiles` con rol
 * `tecnico` de la organización (RLS ya los acota). */
export async function listTecnicos(): Promise<{ id: string; nombre: string }[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre")
    .eq("rol", "tecnico")
    .order("nombre");
  if (error) throw error;
  return data;
}

// ─────────────────────────── Servicios (catálogo) ───────────────────────────

type ServicioRow = {
  id: string;
  nombre: string;
  precio_usd: number;
  garantia_dias: number;
  activo: boolean;
};

function toServicio(row: ServicioRow): Servicio {
  return {
    id: row.id,
    nombre: row.nombre,
    precioUsd: row.precio_usd,
    garantiaDias: row.garantia_dias,
    activo: row.activo,
  };
}

export async function listServicios(): Promise<Servicio[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("servicios")
    .select("id, nombre, precio_usd, garantia_dias, activo")
    .order("nombre");
  if (error) throw error;
  return data.map(toServicio);
}

export async function saveServicio(servicio: Servicio): Promise<Servicio> {
  const supabase = createServerClient();
  const patch = {
    nombre: servicio.nombre,
    precio_usd: servicio.precioUsd,
    garantia_dias: servicio.garantiaDias,
    activo: servicio.activo,
  };
  const query = servicio.id
    ? supabase.from("servicios").update(patch).eq("id", servicio.id)
    : supabase.from("servicios").insert(patch);
  const { data: row, error } = await query
    .select("id, nombre, precio_usd, garantia_dias, activo")
    .single();
  if (error) throw error;
  return toServicio(row);
}
