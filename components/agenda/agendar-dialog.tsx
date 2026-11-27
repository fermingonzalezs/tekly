"use client";

import { InputFecha } from "@/components/ui/input-fecha";
import { useMemo, useRef, useState } from "react";
import { Minus, Plus, Smartphone, Trash2, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, GrillaCampos, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ClientePicker } from "@/components/ui/cliente-picker";
import { useOutsideClick } from "@/components/ui/use-outside-click";
import { turnoTipo, medioPago, MEDIOS_CAJA } from "@/lib/status";
import { fmtUsd } from "@/lib/format";
import { senaEnCaja } from "@/lib/pedidos";
import { useDolar } from "@/lib/dolar";
import { TIENDA_NOMBRE_MAX } from "@/lib/tiendas";
import {
  DURACIONES,
  DURACION_POR_TIPO,
  HORAS_MEDIA,
  etiquetaDia,
  fechaCorta,
  turnosSuperpuestos,
} from "@/lib/agenda";
import { TicketResumen } from "./ticket-resumen";
import type {
  Caja,
  Celular,
  ClienteOpcion,
  ClienteSeleccion,
  MedioPago,
  OtroItem,
  Pago,
  Ticket,
  Tienda,
  TiendaSeleccion,
  Turno,
  TurnoOtroItem,
  TurnoTipo,
} from "@/lib/types";
import type { Negocio } from "@/lib/db/configuracion";
import type { TurnoInput } from "@/app/(app)/agenda/actions";

const MEDIOS = MEDIOS_CAJA;
const TIPOS: TurnoTipo[] = ["compra", "deja", "retira", "cotizar", "otro"];

/** Caja sugerida según el medio; el usuario la puede cambiar a mano. */
function defaultCaja(medio: MedioPago): "usd" | "ars" {
  return medio === "pesos" ? "ars" : "usd";
}

const rid = () => Math.random().toString(36).slice(2);

/** Valor del Select de Tienda para «+ Nueva tienda…» (como en Nueva venta). */
const TIENDA_NUEVA = "__nueva__";

type DraftPago = { _k: string; medio: MedioPago; montoUsd: number; caja: "usd" | "ars" };

export function AgendarDialog({
  open,
  inicial,
  turno,
  celulares,
  otros,
  ticketsListos,
  clientesOpciones,
  atendientes,
  turnosAgenda,
  negocio,
  cajas,
  tiendas = [],
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Fecha/hora precargadas al agendar uno nuevo. */
  inicial: { fecha: string; hora: string } | null;
  /** Turno a editar; `null` = alta. */
  turno: Turno | null;
  celulares: Celular[];
  otros: OtroItem[];
  ticketsListos: Ticket[];
  clientesOpciones: ClienteOpcion[];
  atendientes: { id: string; nombre: string }[];
  /** Turnos conocidos, para avisar si quien atiende ya tiene otro a esa hora. */
  turnosAgenda: Turno[];
  negocio: Negocio;
  /** Los turnos no eligen caja: el recargo informativo sale de la primera
   * caja activa del medio (0 si no hay). */
  cajas: Caja[];
  /** Tiendas extra de la organización (la principal es `negocio.nombre`). */
  tiendas?: Tienda[];
  onClose: () => void;
  onSubmit: (d: TurnoInput) => void;
}) {
  const editando = !!turno;
  const [cliente, setCliente] = useState<ClienteSeleccion | null>(
    turno
      ? turno.clienteId
        ? { tipo: "existente", id: turno.clienteId, nombre: turno.cliente }
        : { tipo: "libre", nombre: turno.cliente }
      : null,
  );
  // «Solo nombre»: el cliente se escribe en texto plano, sin buscarlo ni
  // registrarlo (`tipo: "libre"`, `Turno.clienteId` null).
  const [soloNombre, setSoloNombre] = useState(!!turno && !turno.clienteId);
  const [nombreLibre, setNombreLibre] = useState(turno && !turno.clienteId ? turno.cliente : "");
  const clienteFinal: ClienteSeleccion | null = soloNombre
    ? nombreLibre.trim()
      ? { tipo: "libre", nombre: nombreLibre.trim() }
      : null
    : cliente;
  const [tipo, setTipo] = useState<TurnoTipo>(turno?.tipo ?? "cotizar");
  const [nota, setNota] = useState(turno?.nota ?? "");
  const [fecha, setFecha] = useState(turno?.fecha ?? inicial?.fecha ?? "");
  const [hora, setHora] = useState(turno?.hora ?? inicial?.hora ?? "09:00");
  const [duracionMin, setDuracionMin] = useState(turno?.duracionMin ?? DURACION_POR_TIPO.cotizar);
  const duracionTocada = useRef(editando);
  const [atiendeId, setAtiendeId] = useState<string>(turno?.atiendeId ?? "");

  // Tienda: "" = la principal (nombre del negocio), un id, o TIENDA_NUEVA.
  // Mismo criterio diferido que Nueva venta: la nueva se crea al guardar.
  const [tiendaSel, setTiendaSel] = useState(turno?.tiendaId ?? "");
  const [tiendaNueva, setTiendaNueva] = useState("");
  const [tiendaModal, setTiendaModal] = useState(false);
  const [tiendaModalNombre, setTiendaModalNombre] = useState("");
  const tienda: TiendaSeleccion =
    tiendaSel === TIENDA_NUEVA
      ? { tipo: "nueva", nombre: tiendaNueva }
      : tiendaSel
        ? { tipo: "existente", id: tiendaSel }
        : { tipo: "principal" };
  // Un turno de una tienda ya desactivada: se sigue mostrando su nombre.
  const tiendaInactiva =
    turno?.tiendaId && !tiendas.some((t) => t.id === turno.tiendaId)
      ? { id: turno.tiendaId, nombre: turno.tienda ?? "Tienda" }
      : null;

  // "retira": ticket listo a retirar + cómo se espera cobrar el presupuesto.
  // Arranca en el primero de la lista -- el <Select> no tiene opción vacía
  // (ver RetiraFields), así que con `null` el navegador ya muestra el primer
  // ticket tildado pero el estado de React se queda sin sincronizar: el
  // botón "Agendar" queda deshabilitado sin ninguna pista de por qué.
  const [ticketId, setTicketId] = useState<number | null>(
    turno?.ticketId ?? ticketsListos[0]?.id ?? null,
  );
  const [medioEsperado, setMedioEsperado] = useState<MedioPago>(
    turno?.tipo === "retira" && turno.pagos?.[0] ? (turno.pagos[0].medio as MedioPago) : "pesos",
  );
  const ticket = ticketsListos.find((t) => t.id === ticketId) ?? null;

  // "compra": carrito de celulares disponibles + ítems de "Otros", seña
  // opcional y reserva de stock opcional (antes la reserva era obligatoria).
  const [celularIds, setCelularIds] = useState<string[]>(turno?.celularIds ?? []);
  const [carritoOtros, setCarritoOtros] = useState<TurnoOtroItem[]>(turno?.itemsOtros ?? []);
  // Seña con caja (cualquier tipo de turno): ingreso en la caja elegida,
  // etiquetado «Seña» en Cajas. Mismo circuito que la seña de un pedido.
  const dolar = useDolar().venta;
  const cajasSena = cajas.filter((c) => c.activa || c.id === turno?.sena?.cajaId);
  const [abonaSena, setAbonaSena] = useState(!!turno?.sena);
  const [senaCajaId, setSenaCajaId] = useState(
    turno?.sena?.cajaId ?? cajasSena.find((c) => c.activa)?.id ?? "",
  );
  const [senaMonto, setSenaMonto] = useState(turno?.sena ? String(turno.sena.monto) : "");
  const senaFija = !!turno?.sena?.conciliado;
  const cajaSena = cajasSena.find((c) => c.id === senaCajaId);
  const montoSena = senaMonto.trim() === "" ? Number.NaN : Number(senaMonto);
  const senaUsd =
    abonaSena && cajaSena ? (senaEnCaja(cajaSena.moneda, montoSena, dolar)?.senaUsd ?? null) : null;
  const senaValida = !abonaSena || senaFija || senaUsd !== null;
  const [reservarStock, setReservarStock] = useState(true);

  const choques = turnosSuperpuestos(
    turnosAgenda,
    atiendeId || null,
    fecha,
    hora,
    duracionMin,
    turno?.id ?? null,
  );

  const seleccionados = celulares.filter((e) => celularIds.includes(e.id));
  const totalCarrito =
    seleccionados.reduce((a, e) => a + e.precioUsd, 0) +
    carritoOtros.reduce((a, i) => a + i.precioUsd * (i.cantidad ?? 1), 0);
  const hayItems = celularIds.length > 0 || carritoOtros.length > 0;

  function toggleCelular(id: string) {
    setCelularIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  }

  function removeOtro(otroId: string, serial?: string) {
    setCarritoOtros((p) =>
      p.filter((i) => !(i.otroId === otroId && i.serial === serial)),
    );
  }

  /** Stepper de cantidad de un "Otro" no serializado -- tope: lo que hay en
   * stock (no se deja pedir más de lo disponible). */
  function cambiarCantidad(otroId: string, delta: number) {
    setCarritoOtros((p) =>
      p.map((i) => {
        if (i.otroId !== otroId || i.serial) return i;
        const o = otros.find((x) => x.id === otroId);
        const max = !o || o.serializado ? 1 : o.cantidad;
        return {
          ...i,
          cantidad: Math.min(max, Math.max(1, (i.cantidad ?? 1) + delta)),
        };
      }),
    );
  }


  // "retira" sin ticket no tiene sentido -- sin uno listo para retirar, no
  // se agenda el turno (el selector avisa por qué).
  const puedeAgendar =
    !!clienteFinal && !!fecha && (tipo !== "retira" || !!ticketId) && senaValida;

  function submit() {
    if (!puedeAgendar || !clienteFinal) return;
    onSubmit({
      fecha,
      hora,
      duracionMin,
      atiendeId: atiendeId || null,
      tienda,
      cliente: clienteFinal,
      tipo,
      celularIds: tipo === "compra" ? celularIds : [],
      ticketId: tipo === "retira" ? ticketId : null,
      itemsOtros: tipo === "compra" ? carritoOtros : [],
      pagos:
        // Los pagos sin caja de turnos viejos de compra se conservan tal cual;
        // lo nuevo va como seña (con caja).
        tipo === "compra"
          ? turno?.tipo === "compra"
            ? (turno.pagos ?? [])
            : []
          : tipo === "retira" && ticket
            ? [
                {
                  medio: medioEsperado,
                  montoUsd: ticket.presupuestoUsd,
                  caja: defaultCaja(medioEsperado),
                },
              ]
            : [],
      reservarStock: tipo === "compra" && reservarStock,
      sena: abonaSena
        ? senaFija && turno?.sena
          ? { cajaId: turno.sena.cajaId, monto: turno.sena.monto, cotizacion: turno.sena.cotizacion ?? dolar }
          : { cajaId: senaCajaId, monto: montoSena, cotizacion: dolar }
        : null,
      nota,
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      title={editando ? "Editar turno" : "Agendar turno"}
      formulario
      description={fecha ? `${etiquetaDia(fecha)} · ${hora}` : ""}
      footer={
        <>
          <Button
            onClick={onClose}
            variant="outline" fullOnMobile
          >
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={!puedeAgendar}
            variant="primary" fullOnMobile
          >
            {editando ? "Guardar cambios" : "Agendar"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Información general
          </p>
          <GrillaCampos>
            <Field label="Cliente" className="sm:col-span-2">
              {soloNombre ? (
                <Input
                  value={nombreLibre}
                  onChange={(e) => setNombreLibre(e.target.value)}
                  placeholder="Nombre del cliente"
                  maxLength={120}
                  autoFocus
                />
              ) : (
                <ClientePicker
                  clientes={clientesOpciones}
                  value={cliente}
                  onChange={setCliente}
                  allowLibre
                />
              )}
              <Button
                variant="link"
                size="sm"
                className="mt-1"
                onClick={() => {
                  if (soloNombre) {
                    setSoloNombre(false);
                  } else {
                    if (cliente && !nombreLibre) setNombreLibre(cliente.nombre);
                    setSoloNombre(true);
                  }
                }}
              >
                {soloNombre ? "Buscar un cliente registrado" : "Escribir solo el nombre (sin registrar)"}
              </Button>
            </Field>
            <Field label="Motivo">
              <Select
                value={tipo}
                onChange={(e) => {
                  const t = e.target.value as TurnoTipo;
                  setTipo(t);
                  if (!duracionTocada.current) setDuracionMin(DURACION_POR_TIPO[t]);
                }}
              >
                {TIPOS.map((tp) => (
                  <option key={tp} value={tp}>
                    {turnoTipo[tp].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha">
              <InputFecha value={fecha} onChange={setFecha} />
            </Field>
            <Field label="Hora">
              <Select value={hora} onChange={(e) => setHora(e.target.value)}>
                {!HORAS_MEDIA.includes(hora) && <option value={hora}>{hora}</option>}
                {HORAS_MEDIA.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duración">
              <Select
                value={duracionMin}
                onChange={(e) => {
                  duracionTocada.current = true;
                  setDuracionMin(Number(e.target.value));
                }}
              >
                {!(DURACIONES as readonly number[]).includes(duracionMin) && (
                  <option value={duracionMin}>{duracionMin} min</option>
                )}
                {DURACIONES.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tienda / página">
              <Select
                value={tiendaSel}
                onChange={(e) => {
                  if (e.target.value === TIENDA_NUEVA) {
                    setTiendaModalNombre("");
                    setTiendaModal(true);
                    return;
                  }
                  setTiendaSel(e.target.value);
                }}
              >
                <option value="">{negocio.nombre || "Tienda principal"}</option>
                {tiendaInactiva && <option value={tiendaInactiva.id}>{tiendaInactiva.nombre}</option>}
                {tiendas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
                <option value={TIENDA_NUEVA}>
                  {tiendaNueva ? `${tiendaNueva} (nueva)` : "+ Nueva tienda…"}
                </option>
              </Select>
            </Field>
            <Field label="Atiende" className="sm:col-span-2">
              <Select value={atiendeId} onChange={(e) => setAtiendeId(e.target.value)}>
                <option value="">Sin asignar</option>
                {atendientes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </Select>
              {choques.length > 0 && (
                <p className="mt-1.5 text-[12px] text-amber-700">
                  Ojo: esa persona ya tiene {choques.length === 1 ? "otro turno" : `${choques.length} turnos`} que se
                  {choques.length === 1 ? " pisa" : " pisan"} ({choques.map((c) => `${c.hora} ${c.cliente}`).join(", ")}
                  ) el {fechaCorta(fecha)}. Podés agendarlo igual.
                </p>
              )}
            </Field>
          </GrillaCampos>
        </div>

        {(tipo === "cotizar" || tipo === "deja" || tipo === "otro") && (
          <ComentarioField value={nota} onChange={setNota} />
        )}

        {tipo === "retira" && (
          <RetiraFields
            tickets={ticketsListos}
            ticketId={ticketId}
            onTicketChange={setTicketId}
            medioEsperado={medioEsperado}
            onMedioChange={setMedioEsperado}
            nota={nota}
            onNotaChange={setNota}
          />
        )}

        {tipo === "compra" && (
          <>
            <div>
              <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Ítems
              </p>
              <CarritoBuscador
                celulares={celulares}
                otros={otros}
                celularIds={celularIds}
                carritoOtros={carritoOtros}
                onAddCelular={toggleCelular}
                onAddOtro={(item) => setCarritoOtros((p) => [...p, item])}
              />
              {hayItems && (
                <div className="mt-2 space-y-1.5">
                  {seleccionados.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-[13px]"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <Smartphone className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                        <span className="truncate">
                          {e.modelo} {e.almacenamiento} · {e.color}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {fmtUsd(e.precioUsd)}
                      </span>
                      <IconButton aria-label="Quitar" icon={X} variant="danger-ghost" size="sm" onClick={() => toggleCelular(e.id)} />
                    </div>
                  ))}
                  {carritoOtros.map((i) => {
                    const o = otros.find((x) => x.id === i.otroId);
                    const max = o && !o.serializado ? o.cantidad : 1;
                    return (
                      <div
                        key={`${i.otroId}-${i.serial ?? "x"}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-[13px]"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="min-w-0 flex-1 truncate">
                            {i.nombre}
                            {i.serial && (
                              <span className="text-neutral-400"> · {i.serial}</span>
                            )}
                          </span>
                          {!i.serial && (
                            <span className="flex shrink-0 items-center gap-1">
                              <IconButton aria-label="Restar" icon={Minus} variant="ghost" onClick={() => cambiarCantidad(i.otroId, -1)} className="rounded" />
                              <span className="w-4 text-center tabular-nums">
                                {i.cantidad ?? 1}
                              </span>
                              <IconButton aria-label="Agregar" icon={Plus} variant="ghost" onClick={() => cambiarCantidad(i.otroId, 1)} disabled={(i.cantidad ?? 1) >= max} className="rounded" />
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {fmtUsd(i.precioUsd * (i.cantidad ?? 1))}
                        </span>
                        <IconButton aria-label="Quitar" icon={X} variant="danger-ghost" size="sm" onClick={() => removeOtro(i.otroId, i.serial)} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {hayItems && (
              <p className="text-center text-xs font-semibold tabular-nums text-neutral-500">
                Total {fmtUsd(totalCarrito)}
              </p>
            )}

            {hayItems && (
              <label className="flex items-center justify-center gap-2 text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={reservarStock}
                  onChange={(e) => setReservarStock(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent/40"
                />
                Reservar estos ítems en el stock
              </label>
            )}

            <ComentarioField value={nota} onChange={setNota} />
          </>
        )}

        <SenaTurnoFields
          abona={abonaSena}
          onAbona={(v) => {
            setAbonaSena(v);
            if (!v) setSenaMonto("");
          }}
          cajas={cajasSena}
          cajaId={senaCajaId}
          onCaja={setSenaCajaId}
          monto={senaMonto}
          onMonto={setSenaMonto}
          senaUsd={senaUsd}
          fija={senaFija}
        />
      </div>

      <Dialog
        open={tiendaModal}
        onClose={() => setTiendaModal(false)}
        title="Nueva tienda"
        formulario
        footer={
          <>
            <Button onClick={() => setTiendaModal(false)} variant="outline" fullOnMobile>
              Cancelar
            </Button>
            <Button
              disabled={!tiendaModalNombre.trim()}
              onClick={() => {
                setTiendaNueva(tiendaModalNombre.trim());
                setTiendaSel(TIENDA_NUEVA);
                setTiendaModal(false);
              }}
              variant="primary"
              fullOnMobile
            >
              Usar esta tienda
            </Button>
          </>
        }
      >
        <Field label="Nombre de la tienda">
          <Input
            value={tiendaModalNombre}
            onChange={(e) => setTiendaModalNombre(e.target.value)}
            maxLength={TIENDA_NOMBRE_MAX}
            autoFocus
          />
        </Field>
      </Dialog>
    </Dialog>
  );
}

/** Observaciones -- lo comparten los 4 motivos (antes solo salía para los
 * turnos con equipo, `cotizar`/`deja` no tenían forma de dejar un
 * comentario). */
function ComentarioField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Observaciones
      </p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Notas para este turno (opcional)"
        rows={2}
      />
    </div>
  );
}

/** "Retira reparación": el turno se vincula a un ticket en estado "listo"
 * (ya no a un equipo -- antes marcaba un equipo "vendido" sin ninguna Venta
 * real detrás) y se anota cómo se espera cobrar el presupuesto. */
function RetiraFields({
  tickets,
  ticketId,
  onTicketChange,
  medioEsperado,
  onMedioChange,
  nota,
  onNotaChange,
}: {
  tickets: Ticket[];
  ticketId: number | null;
  onTicketChange: (id: number) => void;
  medioEsperado: MedioPago;
  onMedioChange: (m: MedioPago) => void;
  nota: string;
  onNotaChange: (v: string) => void;
}) {
  const ticket = tickets.find((t) => t.id === ticketId) ?? null;
  return (
    <>
      <div>
        <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Reparación a retirar
        </p>
        {tickets.length === 0 ? (
          <p className="text-[13px] text-neutral-400">
            No hay reparaciones listas para retirar por el momento.
          </p>
        ) : (
          <>
            <Select
              value={ticketId ?? ""}
              onChange={(e) => onTicketChange(Number(e.target.value))}
            >
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  Ticket #{t.id} · {t.cliente} · {t.equipo}
                </option>
              ))}
            </Select>
            <div className="mt-2">
              <TicketResumen ticket={ticket} />
            </div>
          </>
        )}
      </div>
      {tickets.length > 0 && (
        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Método de pago esperado
          </p>
          <Select
            value={medioEsperado}
            onChange={(e) => onMedioChange(e.target.value as MedioPago)}
          >
            {MEDIOS.map((m) => (
              <option key={m} value={m}>
                {medioPago[m].label}
              </option>
            ))}
          </Select>
        </div>
      )}
      <ComentarioField value={nota} onChange={onNotaChange} />
    </>
  );
}

// ── Buscador del carrito de "Compra equipo" ────────────────────

/** Combobox sobre el catálogo real: celulares disponibles + "Otros" (sin
 * servicios ni ítem libre, a diferencia del `ItemBuscador` de Ventas -- acá
 * todo tiene que salir de stock). Un "Otro" serializado aparece como una fila
 * por unidad disponible (mismo criterio que un equipo), uno no serializado
 * como una fila con cantidad. */
function CarritoBuscador({
  celulares,
  otros,
  celularIds,
  carritoOtros,
  onAddCelular,
  onAddOtro,
}: {
  celulares: Celular[];
  otros: OtroItem[];
  celularIds: string[];
  carritoOtros: TurnoOtroItem[];
  onAddCelular: (id: string) => void;
  onAddOtro: (item: TurnoOtroItem) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false));

  const catalogo = useMemo(
    () => [
      ...celulares
        .filter((e) => e.estado === "disponible")
        .map((e) => ({
          key: `e-${e.id}`,
          origen: "celular" as const,
          id: e.id,
          nombre: `${e.modelo} ${e.almacenamiento} ${e.color}`,
          serial: e.imei,
          precioUsd: e.precioUsd,
        })),
      ...otros.flatMap((o) => {
        if (o.serializado) {
          return o.unidades
            .filter((u) => !u.estado || u.estado === "disponible")
            .map((u) => ({
              key: `o-${o.id}-${u.serial}`,
              origen: "otro" as const,
              id: o.id,
              nombre: o.nombre,
              serial: u.serial,
              precioUsd: o.precioUsd,
            }));
        }
        return o.cantidad > 0
          ? [
              {
                key: `o-${o.id}`,
                origen: "otro" as const,
                id: o.id,
                nombre: o.nombre,
                serial: undefined as string | undefined,
                precioUsd: o.precioUsd,
              },
            ]
          : [];
      }),
    ],
    [celulares, otros],
  );

  const matches = catalogo.filter((c) => {
    const needle = q.trim().toLowerCase();
    const coincide =
      !needle ||
      c.nombre.toLowerCase().includes(needle) ||
      (c.serial?.toLowerCase().includes(needle) ?? false);
    if (!coincide) return false;
    if (c.origen === "celular") return !celularIds.includes(c.id);
    // Los ya agregados al carrito no se ofrecen dos veces (por id si no es
    // serializado, por serial si lo es).
    return !carritoOtros.some((i) =>
      c.serial ? i.otroId === c.id && i.serial === c.serial : i.otroId === c.id,
    );
  });

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Buscar equipo o producto (iPad, AirPods…)"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="animate-menu-in origin-top absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
          {matches.slice(0, 8).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                if (c.origen === "celular") {
                  onAddCelular(c.id);
                } else {
                  onAddOtro({
                    otroId: c.id,
                    nombre: c.nombre,
                    precioUsd: c.precioUsd,
                    ...(c.serial ? { serial: c.serial } : { cantidad: 1 }),
                  });
                }
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-neutral-50"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Badge tone={c.origen === "celular" ? "violet" : "blue"}>
                  {c.origen === "celular" ? "Celular" : "Producto"}
                </Badge>
                <span className="truncate">{c.nombre}</span>
                {c.serial && c.serial !== "—" && (
                  <span className="shrink-0 text-[11px] text-neutral-400">{c.serial}</span>
                )}
              </span>
              <span className="shrink-0 font-semibold text-neutral-500">
                {fmtUsd(c.precioUsd)}
              </span>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-neutral-400">
              Sin coincidencias en el catálogo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Seña del turno: casilla «Abonó seña» + caja (cualquiera activa) + monto
 * en la moneda de esa caja. Mismo armado que la seña de un pedido. */
function SenaTurnoFields({
  abona,
  onAbona,
  cajas,
  cajaId,
  onCaja,
  monto,
  onMonto,
  senaUsd,
  fija,
}: {
  abona: boolean;
  onAbona: (v: boolean) => void;
  cajas: Caja[];
  cajaId: string;
  onCaja: (id: string) => void;
  monto: string;
  onMonto: (v: string) => void;
  senaUsd: number | null;
  fija: boolean;
}) {
  const caja = cajas.find((c) => c.id === cajaId);
  return (
    <div className="space-y-3">
      <p className="border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Seña
      </p>
      <label className="flex items-center justify-center gap-2 text-sm text-neutral-600">
        <input
          type="checkbox"
          checked={abona}
          disabled={fija}
          onChange={(e) => onAbona(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent/40"
        />
        Abonó seña
      </label>
      {abona && cajas.length === 0 && (
        <p className="text-sm text-amber-700">
          No hay cajas activas: creá una en{" "}
          <a href="/cajas" className="font-medium underline">
            Cajas
          </a>{" "}
          para registrar la seña.
        </p>
      )}
      {abona && cajas.length > 0 && (
        <GrillaCampos>
          <Field label="Caja" className="sm:col-span-2">
            <Select value={cajaId} disabled={fija} onChange={(e) => onCaja(e.target.value)}>
              {!caja && <option value="">Elegí una caja</option>}
              {cajas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {medioPago[c.medioPago].label} ({c.moneda.toUpperCase()})
                </option>
              ))}
            </Select>
          </Field>
          <Field label={caja?.moneda === "ars" ? "Monto ($)" : "Monto (U$)"}>
            <Input
              type="number"
              min={0}
              step={caja?.moneda === "ars" ? "1" : "0.01"}
              inputMode="decimal"
              value={monto}
              disabled={fija}
              onChange={(e) => onMonto(e.target.value)}
              placeholder="0"
              className="!text-center"
            />
            {caja?.moneda === "ars" && senaUsd !== null && senaUsd > 0 && (
              <p className="mt-1 text-xs tabular-nums text-neutral-500">≈ {fmtUsd(senaUsd)}</p>
            )}
          </Field>
        </GrillaCampos>
      )}
      {abona && (
        <p className="text-xs text-neutral-500">
          {fija
            ? "La seña ya está conciliada en Cajas: no se puede cambiar."
            : "Se registra como ingreso «Seña» en la caja elegida."}
        </p>
      )}
    </div>
  );
}
