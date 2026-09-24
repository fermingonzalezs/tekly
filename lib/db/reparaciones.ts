import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { addMovimiento } from "@/lib/db/inventario";
import { fmtDayMonth, fmtTime } from "@/lib/format";
import type { Checklist, Servicio, Ticket, TicketServicio, TicketStatus } from "@/lib/types";

// ─────────────────────────── Tickets ───────────────────────────

type TicketRow = {
  id: number;
  cliente_id: string | null;
  clientes: { nombre: string } | null;
  marca: string | null;
  equipo: string;
  imei: string | null;
  falla: string | null;
  reparacion_solicitada: string | null;
  clave_codigo: string | null;
  descripcion_equipo: string | null;
  checklist_ingreso: Checklist | null;
  checklist_egreso: Checklist | null;
  tecnico_id: string | null;
  profiles: { nombre: string } | null;
  estado: TicketStatus;
  ingreso: string;
  presupuesto_usd: number;
  servicios: TicketServicio[];
  nota: string | null;
};

const TICKET_COLS =
  "id, cliente_id, clientes(nombre), marca, equipo, imei, falla, reparacion_solicitada, clave_codigo, descripcion_equipo, checklist_ingreso, checklist_egreso, tecnico_id, profiles(nombre), estado, ingreso, presupuesto_usd, servicios, nota";

function toTicket(row: TicketRow): Ticket {
  const ingreso = new Date(row.ingreso);
  return {
    id: row.id,
    clienteId: row.cliente_id ?? "",
    cliente: row.clientes?.nombre ?? "—",
    marca: row.marca ?? undefined,
    equipo: row.equipo,
    imei: row.imei ?? "—",
    falla: row.falla ?? "",
    reparacionSolicitada: row.reparacion_solicitada ?? undefined,
    claveCodigo: row.clave_codigo ?? undefined,
    descripcionEquipo: row.descripcion_equipo ?? undefined,
    checklistIngreso: row.checklist_ingreso ?? undefined,
    checklistEgreso: row.checklist_egreso ?? undefined,
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
  marca?: string;
  equipo: string;
  imei?: string;
  falla: string;
  reparacionSolicitada?: string;
  claveCodigo?: string;
  descripcionEquipo?: string;
  checklistIngreso?: Checklist;
  tecnicoId: string | null;
}): Promise<Ticket> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("tickets")
    .insert({
      cliente_id: data.clienteId,
      marca: data.marca || null,
      equipo: data.equipo,
      imei: data.imei || null,
      falla: data.falla,
      reparacion_solicitada: data.reparacionSolicitada || null,
      clave_codigo: data.claveCodigo || null,
      descripcion_equipo: data.descripcionEquipo || null,
      checklist_ingreso: data.checklistIngreso ?? null,
      tecnico_id: data.tecnicoId,
      estado: "recibido" satisfies TicketStatus,
      servicios: [],
    })
    .select(TICKET_COLS)
    .single();
  if (error) throw error;
  return toTicket(row as unknown as TicketRow);
}

/** Checklist de egreso -- se completa aparte (botón propio en el detalle
 * del ticket), nunca junto con el alta. */
export async function setChecklistEgreso(id: number, checklist: Checklist): Promise<Ticket> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("tickets")
    .update({ checklist_egreso: checklist })
    .eq("id", id)
    .select(TICKET_COLS)
    .single();
  if (error) throw error;
  return toTicket(row as unknown as TicketRow);
}

/** Suma un ítem a "Servicios asociados" (catálogo, repuesto o libre) y
 * recalcula `presupuesto_usd` como la suma de todos. Un `repuesto` además
 * descuenta stock -- mismo patrón leer-y-escribir que `lib/db/ventas.ts`
 * para `VentaItem.repuestos`, salvo que acá el repuesto es un ítem
 * facturable propio (con su precio a mano), no un insumo de otro ítem. */
export async function addTicketItem(ticketId: number, item: TicketServicio): Promise<Ticket> {
  const supabase = createServerClient();
  const { data: current, error: readError } = await supabase
    .from("tickets")
    .select("servicios")
    .eq("id", ticketId)
    .single();
  if (readError) throw readError;

  const servicios: TicketServicio[] = [...((current.servicios as TicketServicio[]) ?? []), item];
  const presupuesto = servicios.reduce((a, s) => a + s.precioUsd * (s.cantidad ?? 1), 0);

  if (item.origen === "repuesto" && item.repuestoId) {
    const cantidad = item.cantidad ?? 1;
    const { data: rep, error: repError } = await supabase
      .from("repuestos")
      .select("stock")
      .eq("id", item.repuestoId)
      .single();
    if (repError) throw repError;
    const { error: stockError } = await supabase
      .from("repuestos")
      .update({ stock: rep.stock - cantidad })
      .eq("id", item.repuestoId);
    if (stockError) throw stockError;
    await addMovimiento(
      "repuesto",
      item.repuestoId,
      `Usado en ticket #${ticketId}: -${cantidad} unidades`,
      "egreso",
    );
  }

  const { data: row, error } = await supabase
    .from("tickets")
    .update({ servicios, presupuesto_usd: presupuesto })
    .eq("id", ticketId)
    .select(TICKET_COLS)
    .single();
  if (error) throw error;
  return toTicket(row as unknown as TicketRow);
}

/** Saca un ítem de "Servicios asociados" por índice -- si era un
 * `repuesto`, repone el stock consumido. */
export async function removeTicketItem(ticketId: number, index: number): Promise<Ticket> {
  const supabase = createServerClient();
  const { data: current, error: readError } = await supabase
    .from("tickets")
    .select("servicios")
    .eq("id", ticketId)
    .single();
  if (readError) throw readError;

  const servicios: TicketServicio[] = (current.servicios as TicketServicio[]) ?? [];
  const item = servicios[index];
  if (!item) throw new Error("Ítem no encontrado");
  const nuevos = servicios.filter((_, i) => i !== index);
  const presupuesto = nuevos.reduce((a, s) => a + s.precioUsd * (s.cantidad ?? 1), 0);

  if (item.origen === "repuesto" && item.repuestoId) {
    const cantidad = item.cantidad ?? 1;
    const { data: rep, error: repError } = await supabase
      .from("repuestos")
      .select("stock")
      .eq("id", item.repuestoId)
      .single();
    if (repError) throw repError;
    const { error: stockError } = await supabase
      .from("repuestos")
      .update({ stock: rep.stock + cantidad })
      .eq("id", item.repuestoId);
    if (stockError) throw stockError;
    await addMovimiento(
      "repuesto",
      item.repuestoId,
      `Devuelto de ticket #${ticketId}: +${cantidad} unidades`,
      "ingreso",
    );
  }

  const { data: row, error } = await supabase
    .from("tickets")
    .update({ servicios: nuevos, presupuesto_usd: presupuesto })
    .eq("id", ticketId)
    .select(TICKET_COLS)
    .single();
  if (error) throw error;
  return toTicket(row as unknown as TicketRow);
}

/** Edita el precio de un ítem ya cargado (por índice) -- no toca stock, solo
 * `precioUsd` y el `presupuesto_usd` recalculado. */
export async function updateTicketItemPrecio(
  ticketId: number,
  index: number,
  precioUsd: number,
): Promise<Ticket> {
  const supabase = createServerClient();
  const { data: current, error: readError } = await supabase
    .from("tickets")
    .select("servicios")
    .eq("id", ticketId)
    .single();
  if (readError) throw readError;

  const servicios: TicketServicio[] = (current.servicios as TicketServicio[]) ?? [];
  if (!servicios[index]) throw new Error("Ítem no encontrado");
  const nuevos = servicios.map((s, i) => (i === index ? { ...s, precioUsd } : s));
  const presupuesto = nuevos.reduce((a, s) => a + s.precioUsd * (s.cantidad ?? 1), 0);

  const { data: row, error } = await supabase
    .from("tickets")
    .update({ servicios: nuevos, presupuesto_usd: presupuesto })
    .eq("id", ticketId)
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

/** No hay tabla de "técnicos" separada -- el selector ofrece cualquier
 * usuario activo de la organización (RLS ya los acota), no solo los de
 * rol `tecnico`: en equipos chicos el admin o un vendedor también arman
 * tickets. */
export async function listTecnicos(): Promise<{ id: string; nombre: string }[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre")
    .eq("activo", true)
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
