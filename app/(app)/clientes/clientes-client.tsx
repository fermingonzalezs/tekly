"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ticketStatus, turnoStatus, dotClass, type Tone } from "@/lib/status";
import { fmtUsd } from "@/lib/format";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import type { Cliente } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/types";
import {
  createClienteAction,
  updateClienteAction,
  deleteClienteAction,
  getClienteHistorialAction,
} from "./actions";
import type { HistorialEntry } from "@/lib/db/clientes";

export function ClientesClient({
  initialClientes,
  charts,
  user,
}: {
  initialClientes: Cliente[];
  charts: React.ReactNode;
  user: SessionUser;
}) {
  const { publish } = useRealtime();
  const esAdmin = user.rol === "admin";
  const [list, setList] = useState<Cliente[]>(initialClientes);
  const [q, setQ] = useState("");
  // ?open=<id>: deep links desde Analíticas (mapa de valor, cohortes, listas
  // de atención) abren la ficha directo -- mismo patrón que compras.
  const openParam = useSearchParams().get("open");
  const [openId, setOpenId] = useState<string | null>(openParam);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startDeleteTransition] = useTransition();

  const open = list.find((c) => c.id === openId) ?? null;

  function eliminarCliente(id: string) {
    const c = list.find((x) => x.id === id);
    setList((p) => p.filter((c) => c.id !== id));
    setOpenId(null);
    setConfirmDelete(false);
    startDeleteTransition(async () => {
      await deleteClienteAction(id);
    });
    if (c) {
      publish({
        type: "item_deleted",
        actor: user.nombre,
        entity: "Cliente",
        label: c.nombre,
      });
    }
  }

  const filtered = useMemo(
    () => list.filter((c) => c.nombre.toLowerCase().includes(q.toLowerCase())),
    [list, q],
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="flex justify-end">
          <button
            onClick={() => setChartsOpen((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-600"
          >
            {chartsOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {chartsOpen ? "Ocultar gráficos" : "Mostrar gráficos"}
          </button>
        </div>
        {chartsOpen && <div className="mt-3">{charts}</div>}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente…"
            className={cn("w-full pl-9", filterPill)}
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft sm:ml-auto sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </button>
      </div>

      <div className="space-y-2 md:hidden">
        {filtered.map((c) => (
          <Card
            key={c.id}
            onClick={() => setOpenId(c.id)}
            className="cursor-pointer overflow-hidden p-0"
          >
            <div className="bg-table-header px-4 py-2 text-white">
              <p className="truncate text-sm font-semibold">{c.nombre}</p>
            </div>
            <div className="flex items-stretch gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-neutral-500">
                  {c.telefono} · {c.email}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 text-[11px] text-neutral-400">
                  <span>Cliente desde {c.desde}</span>
                  <span>{c.compras} compras</span>
                  <span>{c.reparaciones} reparaciones</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center border-l border-neutral-100 pl-3">
                <p className="text-base font-semibold tabular-nums">
                  {fmtUsd(c.gastadoUsd)}
                </p>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
            Sin clientes para esta búsqueda.
          </p>
        )}
      </div>

      <Card className="hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-400">
              <th className={cn("px-5 py-3 text-center", thDivider)}>Cliente</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Teléfono</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Email</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Desde</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Compras</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Reparaciones</th>
              <th className="px-5 py-3 text-center">Gastado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
              >
                <td className="max-w-[160px] truncate px-5 py-2 text-center font-medium">
                  {c.nombre}
                </td>
                <td className="px-5 py-2 text-center text-neutral-500">{c.telefono}</td>
                <td className="max-w-[180px] truncate px-5 py-2 text-center text-neutral-500">
                  {c.email}
                </td>
                <td className="px-5 py-2 text-center text-neutral-500">{c.desde}</td>
                <td className="px-5 py-2 text-center tabular-nums">{c.compras}</td>
                <td className="px-5 py-2 text-center tabular-nums">{c.reparaciones}</td>
                <td className="px-5 py-2 text-center font-semibold tabular-nums">
                  {fmtUsd(c.gastadoUsd)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-neutral-400">
                  Sin clientes para esta búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog
        open={!!open && !editing}
        onClose={() => setOpenId(null)}
        size="lg"
        accent
        title={open?.nombre ?? ""}
        description={open ? `Cliente desde ${open.desde}` : ""}
        footer={
          open && (
            <>
              {esAdmin && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 sm:mr-auto sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar cliente
                </button>
              )}
              <button
                onClick={() => setOpenId(null)}
                className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
              >
                Cerrar
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 sm:w-auto"
              >
                Editar
              </button>
            </>
          )
        }
      >
        {open && <Ficha cliente={open} />}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => open && eliminarCliente(open.id)}
        title="¿Eliminar cliente?"
        confirmLabel="Eliminar cliente"
      >
        {open && `Se eliminará «${open.nombre}». Esta acción no se puede deshacer.`}
      </ConfirmDialog>

      <ClienteFormDialog
        key={open ? `edit-${open.id}-${editing}` : "edit-none"}
        cliente={open}
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={(c) => {
          setList((p) => p.map((x) => (x.id === c.id ? c : x)));
          setOpenId(c.id);
          setEditing(false);
        }}
      />

      <ClienteFormDialog
        key={creating ? "n" : "n0"}
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(c) => {
          setList((p) => [c, ...p]);
          setCreating(false);
        }}
      />
    </div>
  );
}

type FilaHistorial = {
  key: string;
  fecha: string;
  tipo: string;
  tipoTone: Tone;
  detalle: string;
  estadoLabel: string;
  estadoTone: Tone;
  monto: number | null;
};

function filaDe(e: HistorialEntry): FilaHistorial {
  const fecha = new Date(e.fechaISO).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
  if (e.tipo === "venta") {
    return {
      key: `v-${e.id}`,
      fecha,
      tipo: "Venta",
      tipoTone: "green",
      detalle: e.detalle,
      estadoLabel: "Cobrada",
      estadoTone: "green",
      monto: e.montoUsd,
    };
  }
  if (e.tipo === "reparacion") {
    const st = ticketStatus[e.estado as keyof typeof ticketStatus];
    return {
      key: `r-${e.id}`,
      fecha,
      tipo: "Reparación",
      tipoTone: "blue",
      detalle: e.detalle,
      estadoLabel: st.label,
      estadoTone: st.tone,
      monto: e.montoUsd,
    };
  }
  const st = turnoStatus[e.estado as keyof typeof turnoStatus];
  return {
    key: `t-${e.id}`,
    fecha,
    tipo: "Turno",
    tipoTone: "violet",
    detalle: e.detalle,
    estadoLabel: st.label,
    estadoTone: st.tone,
    monto: null,
  };
}

function Ficha({ cliente }: { cliente: Cliente }) {
  const [historial, setHistorial] = useState<HistorialEntry[] | null>(null);
  useEffect(() => {
    let cancelado = false;
    getClienteHistorialAction(cliente.id).then((h) => {
      if (!cancelado) setHistorial(h);
    });
    return () => {
      cancelado = true;
    };
  }, [cliente.id]);

  const filas = (historial ?? []).map(filaDe);

  const infoFields = [
    { label: "Teléfono", value: cliente.telefono },
    { label: "Email", value: cliente.email },
    { label: "Cliente desde", value: cliente.desde },
    { label: "Compras", value: String(cliente.compras) },
    { label: "Reparaciones", value: String(cliente.reparaciones) },
    { label: "Gastado", value: fmtUsd(cliente.gastadoUsd) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Información general
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {infoFields.map((f) => (
            <Card key={f.label} className="p-2 text-center">
              <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                {f.label}
              </p>
              <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">{f.value}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Historial
        </p>

        <Card className="divide-y divide-neutral-100 overflow-hidden md:hidden">
          {historial === null ? (
            <p className="px-4 py-3 text-center text-[13px] text-neutral-400">Cargando…</p>
          ) : filas.length === 0 ? (
            <p className="px-4 py-3 text-center text-[13px] text-neutral-400">
              Sin actividad registrada.
            </p>
          ) : (
            filas.map((f) => (
              <div key={f.key} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-700">
                    <span
                      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass[f.tipoTone])}
                    />
                    {f.tipo}
                  </span>
                  <span className="text-xs tabular-nums text-neutral-400">{f.fecha}</span>
                </div>
                <p className="mt-1 truncate text-sm text-neutral-800">{f.detalle}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <span
                      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass[f.estadoTone])}
                    />
                    {f.estadoLabel}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {f.monto != null ? fmtUsd(f.monto) : "—"}
                  </span>
                </div>
              </div>
            ))
          )}
        </Card>

        <div className="hidden overflow-hidden rounded-xl border border-neutral-200 font-mono md:block">
          <div className="grid grid-cols-[100px_110px_1fr_130px_84px] gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            <span>Fecha</span>
            <span>Tipo</span>
            <span>Detalle</span>
            <span>Estado</span>
            <span>Monto</span>
          </div>
          {historial === null ? (
            <p className="px-4 py-3 text-center text-[13px] text-neutral-400">Cargando…</p>
          ) : filas.length === 0 ? (
            <p className="px-4 py-3 text-center text-[13px] text-neutral-400">
              Sin actividad registrada.
            </p>
          ) : (
            filas.map((f) => (
              <div
                key={f.key}
                className="grid grid-cols-[100px_110px_1fr_130px_84px] items-center gap-2 border-t border-neutral-100 px-4 py-2 text-[12px] first:border-t-0"
              >
                <span className="truncate text-center text-neutral-500">{f.fecha}</span>
                <span className="flex items-center justify-center gap-1.5 truncate text-neutral-700">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass[f.tipoTone])} />
                  {f.tipo}
                </span>
                <span className="truncate text-start text-neutral-800">{f.detalle}</span>
                <span className="flex items-center justify-center gap-1.5 truncate text-neutral-700">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass[f.estadoTone])} />
                  {f.estadoLabel}
                </span>
                <span className="text-end tabular-nums text-neutral-500">
                  {f.monto != null ? fmtUsd(f.monto) : "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** "15/5/2000abc" -> "15/05/2000" mientras se escribe -- solo dígitos,
 * inserta las barras solo, máximo 8 dígitos (DDMMAAAA). */
function maskFechaDDMMAAAA(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const partes = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return partes.join("/");
}

/** "15/05/2000" -> "2000-05-15" (lo que espera la columna `date`).
 * `undefined` si está incompleta o el rango no es plausible. */
function fechaDDMMAAAAaIso(ddmmaaaa: string): string | undefined {
  const m = ddmmaaaa.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const d = Number(dd);
  const mo = Number(mm);
  const y = Number(yyyy);
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900) return undefined;
  return `${yyyy}-${mm}-${dd}`;
}

/** "2000-05-15" -> "15/05/2000", para precargar el input al editar. */
function isoAFechaDDMMAAAA(iso?: string): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function ClienteFormDialog({
  cliente,
  open,
  onClose,
  onSaved,
}: {
  cliente?: Cliente | null;
  open: boolean;
  onClose: () => void;
  onSaved: (c: Cliente) => void;
}) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? "");
  const [telefono, setTelefono] = useState(
    cliente?.telefono && cliente.telefono !== "—" ? cliente.telefono : "",
  );
  const [email, setEmail] = useState(cliente?.email && cliente.email !== "—" ? cliente.email : "");
  const [fechaNacimiento, setFechaNacimiento] = useState(
    isoAFechaDDMMAAAA(cliente?.fechaNacimiento),
  );
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const data = {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        fechaNacimiento: fechaDDMMAAAAaIso(fechaNacimiento),
      };
      const saved = cliente
        ? await updateClienteAction(cliente.id, data)
        : await createClienteAction(data);
      onSaved(saved);
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      accent
      title={cliente ? "Editar cliente" : "Nuevo cliente"}
      footer={
        <>
          <button
            onClick={onClose}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!nombre.trim() || pending}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Guardando…" : cliente ? "Guardar" : "Crear cliente"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre y apellido">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan Pérez" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono">
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 9 11 …" />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@mail.com" />
          </Field>
        </div>
        <Field label="Fecha de nacimiento (opcional)">
          <Input
            value={fechaNacimiento}
            onChange={(e) => setFechaNacimiento(maskFechaDDMMAAAA(e.target.value))}
            placeholder="DD/MM/AAAA"
            inputMode="numeric"
            maxLength={10}
          />
        </Field>
      </div>
    </Dialog>
  );
}
