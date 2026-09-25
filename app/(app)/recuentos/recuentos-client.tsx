"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { dotClass, movimientoTipo } from "@/lib/status";
import { filterPill, thDivider } from "@/lib/ui-styles";
import { cn } from "@/lib/utils";
import type {
  MovimientoItem,
  MovimientoTipo,
  Recuento,
  RecuentoLineaCantidad,
  RecuentoLineaEquipo,
  RecuentoResolucion,
} from "@/lib/types";
import type { SessionUser } from "@/lib/auth/types";
import { resolverRecuentoAction } from "./actions";

const ITEM_TIPO_LABEL: Record<MovimientoItem["itemTipo"], string> = {
  equipo: "Equipo",
  repuesto: "Repuesto",
  otro: "Otro",
};

export function RecuentosClient({
  initialRecuentos,
  initialMovimientos,
  user,
}: {
  initialRecuentos: Recuento[];
  initialMovimientos: MovimientoItem[];
  user: SessionUser;
}) {
  const esAdmin = user.rol === "admin";
  const [vista, setVista] = useState<"recuentos" | "movimientos">("recuentos");

  const [recuentos, setRecuentos] = useState<Recuento[]>(initialRecuentos);
  const [revisandoRecuentoId, setRevisandoRecuentoId] = useState<string | null>(null);
  const [viendoRecuentoId, setViendoRecuentoId] = useState<string | null>(null);
  const pendientes = recuentos.filter((r) => r.estado === "pendiente").length;

  const [movimientos] = useState<MovimientoItem[]>(initialMovimientos);
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | MovimientoTipo>("todos");
  const [itemTipoFiltro, setItemTipoFiltro] = useState<"todos" | MovimientoItem["itemTipo"]>(
    "todos",
  );
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const movimientosFiltrados = movimientos.filter(
    (m) =>
      (tipoFiltro === "todos" || m.tipo === tipoFiltro) &&
      (itemTipoFiltro === "todos" || m.itemTipo === itemTipoFiltro) &&
      (!needle ||
        m.itemNombre.toLowerCase().includes(needle) ||
        m.usuario.toLowerCase().includes(needle) ||
        m.detalle.toLowerCase().includes(needle)),
  );

  return (
    <div className="space-y-5">
      <Tabs
        value={vista}
        onChange={setVista}
        options={[
          { value: "recuentos", label: "Recuentos", count: recuentos.length },
          { value: "movimientos", label: "Movimientos", count: movimientos.length },
        ]}
      />

      {vista === "recuentos" ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard align="left" label="Recuentos" value={recuentos.length} />
            <StatCard
              align="left"
              label="Pendientes"
              value={pendientes}
              valueClassName={pendientes ? "text-amber-600" : undefined}
              hint="de revisar"
            />
            <StatCard align="left" label="Revisados" value={recuentos.length - pendientes} />
          </div>

          <div className="space-y-2 md:hidden">
            {recuentos.map((r) => (
              <RecuentoCard
                key={r.id}
                recuento={r}
                esAdmin={esAdmin}
                onRevisar={() => setRevisandoRecuentoId(r.id)}
                onVer={() => setViendoRecuentoId(r.id)}
              />
            ))}
            {recuentos.length === 0 && (
              <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
                Sin recuentos todavía. Se cargan desde Inventario → «Recuento»,
                en cada pestaña (Equipos/Repuestos/Otros).
              </p>
            )}
          </div>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Fecha</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Tipo</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Responsable</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Diferencias</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Estado</th>
                  <th className="px-5 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recuentos.map((r) => (
                  <RecuentoRow
                    key={r.id}
                    recuento={r}
                    esAdmin={esAdmin}
                    onRevisar={() => setRevisandoRecuentoId(r.id)}
                    onVer={() => setViendoRecuentoId(r.id)}
                  />
                ))}
                {recuentos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-neutral-400">
                      Sin recuentos todavía. Se cargan desde Inventario → «Recuento», en
                      cada pestaña (Equipos/Repuestos/Otros).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <RevisarRecuentoDialog
            key={revisandoRecuentoId ?? "none"}
            recuento={recuentos.find((r) => r.id === revisandoRecuentoId) ?? null}
            onClose={() => setRevisandoRecuentoId(null)}
            onResuelto={(resuelto) => {
              setRecuentos((prev) => prev.map((r) => (r.id === resuelto.id ? resuelto : r)));
              setRevisandoRecuentoId(null);
            }}
          />

          <RevisarRecuentoDialog
            key={viendoRecuentoId ? `ver-${viendoRecuentoId}` : "ver-none"}
            recuento={recuentos.find((r) => r.id === viendoRecuentoId) ?? null}
            onClose={() => setViendoRecuentoId(null)}
            readOnly
          />
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por ítem, usuario o detalle…"
                className={cn("w-full pl-9", filterPill)}
              />
            </div>
            <Select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as typeof tipoFiltro)}
              className="sm:w-44"
            >
              <option value="todos">Todos los tipos</option>
              {(Object.keys(movimientoTipo) as MovimientoTipo[]).map((t) => (
                <option key={t} value={t}>
                  {movimientoTipo[t].label}
                </option>
              ))}
            </Select>
            <Select
              value={itemTipoFiltro}
              onChange={(e) => setItemTipoFiltro(e.target.value as typeof itemTipoFiltro)}
              className="sm:w-40"
            >
              <option value="todos">Equipos, repuestos y otros</option>
              {(Object.keys(ITEM_TIPO_LABEL) as MovimientoItem["itemTipo"][]).map((t) => (
                <option key={t} value={t}>
                  {ITEM_TIPO_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2 md:hidden">
            {movimientosFiltrados.map((m, i) => (
              <MovimientoCard key={i} movimiento={m} />
            ))}
            {movimientosFiltrados.length === 0 && (
              <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
                Sin movimientos para estos filtros.
              </p>
            )}
          </div>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Fecha</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Tipo</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Ítem</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Usuario</th>
                  <th className="px-5 py-3 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map((m, i) => (
                  <MovimientoRow key={i} movimiento={m} />
                ))}
                {movimientosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-400">
                      Sin movimientos para estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function MovimientoCard({ movimiento: m }: { movimiento: MovimientoItem }) {
  const info = movimientoTipo[m.tipo];
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900">
            {ITEM_TIPO_LABEL[m.itemTipo]} · {m.itemNombre}
          </p>
          <p className="truncate text-xs text-neutral-500">
            {m.fecha} {m.hora} · {m.usuario}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[info.tone])} />
          {info.label}
        </span>
      </div>
      <p className="mt-2 truncate text-xs text-neutral-500">{m.detalle}</p>
    </Card>
  );
}

function MovimientoRow({ movimiento: m }: { movimiento: MovimientoItem }) {
  const info = movimientoTipo[m.tipo];
  return (
    <tr className="border-t border-neutral-100 first:border-t-0">
      <td className="px-5 py-2 text-center text-neutral-500">
        {m.fecha}
        <span className="block text-xs text-neutral-400">{m.hora}</span>
      </td>
      <td className="px-5 py-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[info.tone])} />
          {info.label}
        </span>
      </td>
      <td className="max-w-[180px] truncate px-5 py-2 text-center">
        <span className="text-neutral-400">{ITEM_TIPO_LABEL[m.itemTipo]}</span> {m.itemNombre}
      </td>
      <td className="px-5 py-2 text-center">{m.usuario}</td>
      <td className="max-w-[320px] truncate px-5 py-2 text-start">{m.detalle}</td>
    </tr>
  );
}

const RECUENTO_TIPO_LABEL: Record<Recuento["tipo"], string> = {
  equipos: "Equipos",
  repuestos: "Repuestos",
  otros: "Otros",
};

function recuentoEstadoInfo(r: Recuento): { label: string; tone: "amber" | "green" } {
  if (r.estado === "pendiente") return { label: "Pendiente", tone: "amber" };
  return { label: r.revisadoPor ? "Revisado" : "Sin diferencias", tone: "green" };
}

function RecuentoCard({
  recuento: r,
  esAdmin,
  onRevisar,
  onVer,
}: {
  recuento: Recuento;
  esAdmin: boolean;
  onRevisar: () => void;
  onVer: () => void;
}) {
  const info = recuentoEstadoInfo(r);
  const puedeRevisar = esAdmin && r.estado === "pendiente";
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900">
            {RECUENTO_TIPO_LABEL[r.tipo]} · {r.fecha} {r.hora}
          </p>
          <p className="truncate text-xs text-neutral-500">
            {r.responsable} · {r.lineas.length} diferencia{r.lineas.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[info.tone])} />
          {info.label}
        </span>
      </div>
      {puedeRevisar ? (
        <button
          onClick={onRevisar}
          className="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-full border border-accent/40 text-xs font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
        >
          Revisar
        </button>
      ) : (
        r.estado === "revisado" && (
          <button
            onClick={onVer}
            className="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            Ver detalle
          </button>
        )
      )}
    </Card>
  );
}

function RecuentoRow({
  recuento: r,
  esAdmin,
  onRevisar,
  onVer,
}: {
  recuento: Recuento;
  esAdmin: boolean;
  onRevisar: () => void;
  onVer: () => void;
}) {
  const info = recuentoEstadoInfo(r);
  const puedeRevisar = esAdmin && r.estado === "pendiente";
  return (
    <tr className="border-t border-neutral-100 first:border-t-0">
      <td className="px-5 py-2 text-center text-neutral-500">
        {r.fecha}
        <span className="block text-xs text-neutral-400">{r.hora}</span>
      </td>
      <td className="px-5 py-2 text-center">{RECUENTO_TIPO_LABEL[r.tipo]}</td>
      <td className="px-5 py-2 text-center">{r.responsable}</td>
      <td className="px-5 py-2 text-center tabular-nums">{r.lineas.length}</td>
      <td className="px-5 py-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[info.tone])} />
          {info.label}
        </span>
      </td>
      <td className="px-5 py-2 text-center">
        {puedeRevisar ? (
          <button
            onClick={onRevisar}
            className="mx-auto flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-3 text-xs font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
          >
            Revisar
          </button>
        ) : r.estado === "revisado" ? (
          <button
            onClick={onVer}
            className="mx-auto flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            Ver detalle
          </button>
        ) : (
          <span className="text-xs text-neutral-300">—</span>
        )}
      </td>
    </tr>
  );
}

/** Las dos resoluciones válidas para una línea, según lo que representa --
 * un equipo "reapareció" (estaba extraviado y ahora se encontró) se
 * resuelve distinto a uno "faltante" (se esperaba presente y no apareció).
 * Para repuestos/otros siempre es la misma dupla (ajustar o descartar). */
function opcionesResolucion(
  recuento: Recuento,
  linea: RecuentoLineaEquipo | RecuentoLineaCantidad,
): { value: RecuentoResolucion; label: string }[] {
  if (recuento.tipo === "equipos") {
    const l = linea as RecuentoLineaEquipo;
    return l.encontrado
      ? [
          { value: "restaurado", label: "Restaurar a disponible" },
          { value: "descartado", label: "Descartar (sigue extraviado)" },
        ]
      : [
          { value: "confirmado", label: "Confirmar extraviado" },
          { value: "descartado", label: "Descartar (fue un error)" },
        ];
  }
  const l = linea as RecuentoLineaCantidad;
  return [
    { value: "ajustado", label: `Ajustar a ${l.cantidadContada}` },
    { value: "descartado", label: "Descartar" },
  ];
}

/** Label de la resolución ya tomada, para el modo de solo lectura -- misma
 * dupla de `opcionesResolucion`, pero mostrando cuál quedó fija en vez de
 * ofrecerlas para elegir. */
function resolucionLabel(
  recuento: Recuento,
  linea: RecuentoLineaEquipo | RecuentoLineaCantidad,
): string {
  return (
    opcionesResolucion(recuento, linea).find((o) => o.value === linea.resolucion)?.label ??
    linea.resolucion
  );
}

function RevisarRecuentoDialog({
  recuento,
  onClose,
  onResuelto,
  readOnly = false,
}: {
  recuento: Recuento | null;
  onClose: () => void;
  onResuelto?: (r: Recuento) => void;
  /** Modo "Ver detalle" para un recuento ya revisado: muestra la resolución
   * que quedó fija en cada línea en vez de los botones para elegirla, y el
   * footer solo tiene "Cerrar" -- no llama a `resolverRecuentoAction`. */
  readOnly?: boolean;
}) {
  const [resoluciones, setResoluciones] = useState<Record<string, RecuentoResolucion>>(() =>
    Object.fromEntries((recuento?.lineas ?? []).map((l) => [l.itemId, "pendiente" as const])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const todasResueltas =
    !!recuento && recuento.lineas.every((l) => resoluciones[l.itemId] !== "pendiente");

  function guardar() {
    if (!recuento || !onResuelto) return;
    setError(null);
    startTransition(async () => {
      try {
        const resuelto = await resolverRecuentoAction(recuento.id, resoluciones);
        onResuelto(resuelto);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar la revisión.");
      }
    });
  }

  return (
    <Dialog
      open={!!recuento}
      onClose={onClose}
      accent
      size="lg"
      title={
        recuento
          ? `${readOnly ? "Recuento" : "Revisar recuento"} · ${RECUENTO_TIPO_LABEL[recuento.tipo]}`
          : ""
      }
      description={
        recuento
          ? readOnly && recuento.revisadoPor
            ? `Revisado por ${recuento.revisadoPor} · ${recuento.revisadoEn}`
            : `${recuento.responsable} · ${recuento.fecha} ${recuento.hora}`
          : ""
      }
      footer={
        readOnly ? (
          <button
            onClick={onClose}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:ml-auto sm:w-auto"
          >
            Cerrar
          </button>
        ) : (
          <>
            <button
              onClick={onClose}
              className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={!todasResueltas || pending}
              className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
            >
              {pending ? "Guardando…" : "Guardar revisión"}
            </button>
          </>
        )
      }
    >
      {recuento && (
        <div className="space-y-2">
          {recuento.comentarioGeneral && (
            <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
              "{recuento.comentarioGeneral}"
            </p>
          )}
          {recuento.lineas.length === 0 && (
            <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
              Sin diferencias -- lo contado coincidió con el sistema en todo.
            </p>
          )}
          {recuento.lineas.map((linea) => {
            const opciones = opcionesResolucion(recuento, linea);
            const esEquipo = recuento.tipo === "equipos";
            const equipoLinea = linea as RecuentoLineaEquipo;
            const cantidadLinea = linea as RecuentoLineaCantidad;
            return (
              <Card key={linea.itemId} className="p-3">
                <p className="truncate text-sm font-medium text-neutral-900">{linea.detalle}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {esEquipo
                    ? equipoLinea.encontrado
                      ? "Estaba extraviado · se encontró en el recuento"
                      : "Se esperaba presente · no se encontró"
                    : `Sistema: ${cantidadLinea.cantidadSistema} · Contado: ${cantidadLinea.cantidadContada}`}
                </p>
                {esEquipo && !equipoLinea.encontrado && equipoLinea.comentario && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                    "{equipoLinea.comentario}"
                  </p>
                )}
                {!esEquipo && cantidadLinea.comentario && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                    "{cantidadLinea.comentario}"
                  </p>
                )}
                {readOnly ? (
                  <p className="mt-2 text-xs font-medium text-accent">
                    {resolucionLabel(recuento, linea)}
                  </p>
                ) : (
                  <div className="mt-2 flex rounded-lg border border-neutral-200 p-0.5">
                    {opciones.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setResoluciones((p) => ({ ...p, [linea.itemId]: opt.value }))
                        }
                        className={cn(
                          "flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors",
                          resoluciones[linea.itemId] === opt.value
                            ? "bg-accent-soft text-accent"
                            : "text-neutral-500 hover:bg-neutral-50",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </Dialog>
  );
}
