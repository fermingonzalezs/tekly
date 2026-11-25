"use client";

import { Button, IconButton } from "@/components/ui/button";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Trash2, FileText, Smartphone, Laptop, Wrench, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, GrillaCampos, Input, Select, Textarea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";
import { SeccionTabla } from "@/components/ui/seccion-tabla";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { GraficoBarrasVerticales, GraficoRanking } from "@/components/seccion/graficos";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ReciboImprimir,
  ReciboCampos,
  ReciboChecklist,
  ReciboNota,
} from "@/components/recibos/recibo";
import { medioPago as medioPagoCfg, MEDIOS_CAJA, compraEstado, dotClass } from "@/lib/status";
import { fmtUsd, fmtArs, fmtDateSlash } from "@/lib/format";
import { useDolar } from "@/lib/dolar";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import {
  gastoPorMes,
  gastoPorProveedor,
  resumenCompras,
  erroresCompraStock,
  prorratearCostos,
  costoFinalUnitario,
  resumenCompraStock,
  serieDeItem,
  TIPO_ITEM_COMPRA_LABEL,
  type ItemCompraStock,
  type TipoItemCompra,
} from "@/lib/compras";
import type {
  Caja,
  Celular,
  Compra,
  CompraEstado,
  CompraItem,
  IngresoStock,
  MedioPago,
  Notebook,
  OtroItem,
  Repuesto,
  Variante,
} from "@/lib/types";
import {
  CelularFormDialog,
  NotebookFormDialog,
  IngresoDialog,
} from "../inventario/inventario-client";
import type { Negocio } from "@/lib/db/configuracion";
import type { SessionUser } from "@/lib/auth/types";
import { tieneRol } from "@/lib/roles";
import {
  createCompraAction,
  marcarRecibidaAction,
  deleteCompraAction,
  pasarCanjeAlStockAction,
} from "./actions";

const MEDIOS = MEDIOS_CAJA;

/** Lo que Nueva compra necesita para armar ítems que suben al stock. */
export type StockParaCompra = {
  variantes: Variante[];
  celulares: Celular[];
  notebooks: Notebook[];
  repuestos: Repuesto[];
  otros: OtroItem[];
};

const TIPO_ICONO: Record<TipoItemCompra, typeof Smartphone> = {
  celular: Smartphone,
  notebook: Laptop,
  repuesto: Wrench,
  otro: Package,
};

/** Link a la unidad/ítem en Inventario. */
function hrefDeIngreso(i: IngresoStock): string | null {
  if (i.celularId) return `/inventario?tab=celulares&celular=${i.celularId}`;
  if (i.notebookId) return `/inventario?tab=notebooks&notebook=${i.notebookId}`;
  if (i.repuestoId) return `/inventario?tab=repuestos&q=${encodeURIComponent(i.detalle)}`;
  if (i.otroId) return `/inventario?tab=otros&q=${encodeURIComponent(i.detalle)}`;
  return null;
}

function matchesIngreso(i: IngresoStock, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [i.detalle, i.serie, i.proveedor, i.compraId]
    .filter(Boolean)
    .some((x) => x!.toLowerCase().includes(needle));
}

/** Nombre de la contraparte -- proveedor de siempre, o el cliente cuando
 * es un canje recibido en una venta (`origen === "canje"`, ver "Ventas" en
 * CLAUDE.md). */
function contraparteDe(c: Compra) {
  return c.proveedor || (c.origen === "canje" ? c.cliente ?? "" : "") || "Sin proveedor";
}

/** Canje cuyo equipo todavía no pasó al inventario. */
function canjeSinIngresar(c: Compra) {
  return c.origen === "canje" && !c.celularId;
}

/** Datos del equipo de un canje. Los canjes anteriores a las columnas
 * `canje_*` (plan 020) toman el modelo del ítem y el color del checklist. */
function equipoDeCanje(c: Compra) {
  return {
    modelo: c.canjeModelo || c.items[0]?.detalle || "—",
    color: c.canjeColor || c.checklist?.color || "",
    condicion: c.canjeCondicion || "",
    bateria: c.canjeBateria,
  };
}

function matchesQuery(c: Compra, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (contraparteDe(c).toLowerCase().includes(needle)) return true;
  return c.items.some((i) => i.detalle.toLowerCase().includes(needle));
}

export function ComprasClient({
  initialCompras,
  ingresos,
  user,
  negocio,
  cajas,
  stock,
}: {
  initialCompras: Compra[];
  ingresos: IngresoStock[];
  user: SessionUser;
  negocio: Negocio;
  cajas: Caja[];
  stock: StockParaCompra;
}) {
  const { publish } = useRealtime();
  const esAdmin = tieneRol(user, "admin");
  const [list, setList] = useState<Compra[]>(initialCompras);
  const openParam = useSearchParams().get("open");
  const [estadoFiltro, setEstadoFiltro] = useState<"todos" | CompraEstado | "canje_sin_ingresar">(
    "todos",
  );
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(openParam);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [eliminarMovimientoCaja, setEliminarMovimientoCaja] = useState(true);
  const [quitarDelStock, setQuitarDelStock] = useState(true);
  const [avisoBorrado, setAvisoBorrado] = useState<string | null>(null);
  const [vista, setVista] = useState<"compras" | "ingresos">(
    useSearchParams().get("tab") === "ingresos" ? "ingresos" : "compras",
  );
  const [tipoIngreso, setTipoIngreso] = useState<"todos" | TipoItemCompra>("todos");
  const [recibo, setRecibo] = useState(false);
  /** Canje que se está pasando al stock (formulario de celular abierto). */
  const [pasando, setPasando] = useState<Compra | null>(null);
  const [errorPasar, setErrorPasar] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const router = useRouter();

  // ?accion=nueva-compra: el buscador global (CommandPalette) navega acá con
  // ese param. Efecto aparte del openParam de arriba (no tocarlo) y no un
  // useState inicial, para que también funcione estando ya parado en
  // /compras -- el componente no se remonta en la misma ruta.
  const [varianteInicial, setVarianteInicial] = useState<string | null>(null);
  useEffect(() => {
    if (searchParams.get("accion") !== "nueva-compra") return;
    // ?variante=<id>: «Agregar unidad» desde la vista agrupada de Inventario.
    setVarianteInicial(searchParams.get("variante"));
    setCreating(true);
    router.replace("/compras"); // limpia el param -- evita reabrir con back/refresh
  }, [searchParams, router]);

  const ingresosFiltrados = useMemo(
    () =>
      ingresos.filter(
        (i) => (tipoIngreso === "todos" || i.tipo === tipoIngreso) && matchesIngreso(i, q),
      ),
    [ingresos, tipoIngreso, q],
  );

  const filtered = useMemo(
    () =>
      list.filter(
        (c) =>
          (estadoFiltro === "todos" ||
            (estadoFiltro === "canje_sin_ingresar" ? canjeSinIngresar(c) : c.estado === estadoFiltro)) &&
          matchesQuery(c, q),
      ),
    [list, estadoFiltro, q],
  );

  const open = list.find((c) => c.id === openId) ?? null;
  const resumen = useMemo(() => resumenCompras(filtered), [filtered]);
  const porMes = useMemo(() => gastoPorMes(filtered), [filtered]);
  const porProveedor = useMemo(() => gastoPorProveedor(filtered), [filtered]);

  function marcarRecibida(id: string) {
    startTransition(async () => {
      const actualizada = await marcarRecibidaAction(id);
      setList((prev) => prev.map((c) => (c.id === id ? actualizada : c)));
    });
  }

  function eliminarCompra(id: string) {
    const c = list.find((x) => x.id === id);
    setList((prev) => prev.filter((c) => c.id !== id));
    setOpenId(null);
    setConfirmDelete(false);
    const borrarMovimiento = !!c?.cajaId && eliminarMovimientoCaja;
    const sacarStock = (!!c?.subeStock || (c?.origen === "canje" && !!c.celularId)) && quitarDelStock;
    startTransition(async () => {
      const res = await deleteCompraAction(id, {
        eliminarMovimientoCaja: borrarMovimiento,
        quitarDelStock: sacarStock,
      });
      setAvisoBorrado(
        res.conservados.length > 0
          ? `${id}: quedaron en el stock porque ya se vendieron o se movieron: ${res.conservados.join(", ")}.`
          : null,
      );
      router.refresh();
    });
    if (c) {
      publish({
        type: "item_deleted",
        actor: user.nombre,
        entity: "Compra",
        label: `${c.id} · ${contraparteDe(c)}`,
      });
    }
  }

  return (
    <SeccionTabla
      id="compras"
      graficos={
        <>
          <GraficoBarrasVerticales
            title="Gasto por mes"
            sub={`${resumen.cantidad} compras`}
            rows={porMes}
            fmt={fmtUsd}
            vacio="Sin compras en el período."
          />
          <GraficoRanking
            title="Gasto por proveedor"
            sub="Top proveedores y clientes de canje"
            rows={porProveedor}
            fmt={fmtUsd}
            vacio="Sin compras en el período."
          />
        </>
      }
      tarjetas={
        <>
          <StatCard align="left" label="Compras" value={resumen.cantidad} hint="del período" />
          <StatCard align="left" label="Gastado" value={fmtUsd(resumen.gastadoUsd)} />
          <StatCard
            align="left"
            label="Pendientes de recepción"
            value={resumen.pendientes}
            hint="sin recibir"
          />
          <StatCard
            align="left"
            label="Ticket promedio"
            value={fmtUsd(resumen.ticketPromedioUsd)}
          />
        </>
      }
      filtros={
        <BarraFiltros
          tabs={
            <Tabs
              value={vista}
              onChange={setVista}
              options={[
                { value: "compras" as const, label: "Compras", count: list.length },
                { value: "ingresos" as const, label: "Ingresos", count: ingresos.length },
              ]}
            />
          }
          contadorFiltros={
            (vista === "compras" ? (estadoFiltro !== "todos" ? 1 : 0) : tipoIngreso !== "todos" ? 1 : 0) +
            (q ? 1 : 0)
          }
          busqueda={
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  vista === "compras" ? "Buscar por proveedor o ítem…" : "Buscar producto, IMEI/serie o proveedor…"
                }
                className={cn("w-full pl-9", filterPill)}
                aria-label={vista === "compras" ? "Buscar compras" : "Buscar ingresos"}
              />
            </div>
          }
          filtros={
            vista === "ingresos" ? (
              <Select
                value={tipoIngreso}
                onChange={(e) => setTipoIngreso(e.target.value as "todos" | TipoItemCompra)}
                className={cn("w-full sm:w-44", filterPill)}
                aria-label="Filtrar por tipo"
              >
                <option value="todos">Todos los tipos</option>
                {(Object.keys(TIPO_ITEM_COMPRA_LABEL) as TipoItemCompra[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPO_ITEM_COMPRA_LABEL[t]}
                  </option>
                ))}
              </Select>
            ) : (
            <Select
              value={estadoFiltro}
              onChange={(e) =>
                setEstadoFiltro(e.target.value as "todos" | CompraEstado | "canje_sin_ingresar")
              }
              className={cn("w-full sm:w-44", filterPill)}
              aria-label="Filtrar por estado"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="recibida">Recibida</option>
              <option value="canje_sin_ingresar">Canjes sin ingresar al stock</option>
            </Select>
            )
          }
          accion={
            <Button icon={Plus}
              onClick={() => setCreating(true)}
              variant="tonal" fullOnMobile
            >
              Nueva compra
            </Button>
          }
        />
      }
    >
      {avisoBorrado && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {avisoBorrado}
        </p>
      )}

      {vista === "ingresos" ? (
        <IngresosTabla
          ingresos={ingresosFiltrados}
          onOpenCompra={(id) => list.some((c) => c.id === id) && setOpenId(id)}
        />
      ) : (
      <>
      <div className="space-y-2 md:hidden">
        {filtered.map((c) => (
          <Card
            key={c.id}
            onClick={() => setOpenId(c.id)}
            className="cursor-pointer overflow-hidden p-0"
          >
            <div className="flex items-center justify-between gap-2 bg-table-header px-4 py-2 text-white">
              <span className="text-sm font-semibold">{c.id}</span>
              <span className="text-xs text-white/70">{c.fecha}</span>
            </div>

            <div className="flex items-stretch gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{contraparteDe(c)}</p>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {c.items.map((i) => i.detalle).join(" · ")}
                </p>
                {canjeSinIngresar(c) && (
                  <p className="mt-0.5 text-[11px] font-medium text-amber-600">Canje · sin ingresar al stock</p>
                )}

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", dotClass[medioPagoCfg[c.medioPago].tone])}
                    />
                    {medioPagoCfg[c.medioPago].label}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", dotClass[compraEstado[c.estado].tone])}
                    />
                    {compraEstado[c.estado].label}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-center justify-center border-l border-neutral-100 pl-3 text-center">
                <p className="text-base font-semibold tabular-nums">{fmtUsd(c.totalUsd)}</p>
                {c.montoArs != null && (
                  <p className="text-[11px] tabular-nums text-neutral-400">{fmtArs(c.montoArs)}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
            Sin compras para esta búsqueda.
          </p>
        )}
      </div>

      <Card className="hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-400">
              <th className={cn("px-5 py-3 text-center", thDivider)}>Compra</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Contraparte</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Detalle</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Medio</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Estado</th>
              <th className="px-5 py-3 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
              >
                <td className="px-5 py-2 text-center font-medium text-neutral-500">
                  {c.id}
                  <span className="block text-xs font-normal text-neutral-400">{c.fecha}</span>
                </td>
                <td className="px-5 py-2 text-start font-medium">{contraparteDe(c)}</td>
                <td className="max-w-[240px] truncate px-5 py-2 text-start text-neutral-500">
                  {c.items.map((i) => i.detalle).join(" · ")}
                </td>
                <td className="px-5 py-2 text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", dotClass[medioPagoCfg[c.medioPago].tone])}
                    />
                    {medioPagoCfg[c.medioPago].label}
                  </span>
                </td>
                <td className="px-5 py-2 text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", dotClass[compraEstado[c.estado].tone])}
                    />
                    {compraEstado[c.estado].label}
                  </span>
                  {c.subeStock && (
                    <span className="mt-1 block text-[11px] font-medium text-neutral-500">
                      Ingresó al stock
                    </span>
                  )}
                  {c.origen === "canje" && (
                    <span
                      className={cn(
                        "mt-1 block text-[11px] font-medium",
                        c.celularId ? "text-neutral-500" : "text-amber-600",
                      )}
                    >
                      {c.celularId ? "Canje · en el stock" : "Canje · sin ingresar"}
                    </span>
                  )}
                </td>
                <td className="px-5 py-2 text-center font-semibold tabular-nums">
                  {fmtUsd(c.totalUsd)}
                  {c.montoArs != null && (
                    <span className="block text-[11px] font-normal text-neutral-400">
                      {fmtArs(c.montoArs)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-neutral-400">
                  Sin compras para esta búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      </>
      )}

      <Dialog
        open={!!open}
        onClose={() => setOpenId(null)}
        size="2xl"
        title={open?.id ?? ""}
        description={open ? `${open.fecha} · ${contraparteDe(open)}` : ""}
        footer={
          open && (
            <>
              {esAdmin && (
                <Button icon={Trash2}
                  onClick={() => {
                    setEliminarMovimientoCaja(true);
                    setQuitarDelStock(true);
                    setConfirmDelete(true);
                  }}
                  variant="danger-outline" fullOnMobile className="sm:mr-auto"
                >
                  Eliminar compra
                </Button>
              )}
              <Button
                onClick={() => setOpenId(null)}
                variant="outline" fullOnMobile
              >
                Cerrar
              </Button>
              {open.origen === "canje" && (
                <Button icon={FileText}
                  onClick={() => setRecibo(true)}
                  variant="tonal" fullOnMobile
                >
                  Imprimir recibo de canje
                </Button>
              )}
              {canjeSinIngresar(open) && (
                <Button
                  onClick={() => {
                    setErrorPasar(null);
                    setPasando(open);
                  }}
                  variant="primary" fullOnMobile
                >
                  Pasar al stock
                </Button>
              )}
              {open.estado === "pendiente" && (
                <Button
                  disabled={pending}
                  onClick={() => {
                    marcarRecibida(open.id);
                    setOpenId(null);
                  }}
                  variant="primary" fullOnMobile
                >
                  Marcar como recibida
                </Button>
              )}
            </>
          )
        }
      >
        {open && errorPasar && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorPasar}
          </p>
        )}
        {open && (
          <CompraDetalle
            compra={open}
            ingresos={ingresos.filter((i) => i.compraId === open.id)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => open && eliminarCompra(open.id)}
        title="¿Eliminar compra?"
        confirmLabel="Eliminar compra"
      >
        {open && (
          <>
            <p>
              Se eliminará «{open.id}» de {contraparteDe(open)}. Esta acción no se puede deshacer.
            </p>
            {open.origen === "proveedor" && open.cajaId && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={eliminarMovimientoCaja}
                  onChange={(e) => setEliminarMovimientoCaja(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Eliminar también el movimiento de caja generado por esta compra
              </label>
            )}
            {(open.subeStock || (open.origen === "canje" && !!open.celularId)) && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={quitarDelStock}
                  onChange={(e) => setQuitarDelStock(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Sacar del stock lo que ingresó con esta compra (lo que ya se vendió o se movió se
                conserva)
              </label>
            )}
          </>
        )}
      </ConfirmDialog>

      {open && open.origen === "canje" && (
        <ReciboImprimir
          open={recibo}
          onClose={() => setRecibo(false)}
          titulo="Recibo de canje"
          nro={open.id}
          fecha={fmtDateSlash(open.fechaISO)}
          cliente={open.cliente ?? ""}
          negocio={negocio}
          compacto
          sello="canje"
        >
          {(() => {
            const eq = equipoDeCanje(open);
            return (
              <ReciboCampos
                filas={[
                  ["Modelo", eq.modelo],
                  ["Serial / IMEI", open.imei || "—"],
                  ["Color", eq.color || "—"],
                  ["Estado", eq.condicion || "—"],
                  [
                    "Batería",
                    eq.condicion === "NUEVO" ? "No aplica" : eq.bateria !== undefined ? `${eq.bateria} %` : "—",
                  ],
                ]}
              />
            );
          })()}
          {open.checklist && (
            <ReciboChecklist titulo="Checklist de ingreso" checklist={open.checklist} ocultarColor />
          )}
          <ReciboCampos
            className="mt-5"
            filas={[
              ["Aplicado a", open.ventaId ? `Venta ${open.ventaId}` : "—"],
              ["Valor reconocido", fmtUsd(open.totalUsd)],
            ]}
          />
          <ReciboNota titulo="Detalles del equipo" texto={open.aclaraciones ?? ""} />
        </ReciboImprimir>
      )}

      {pasando && (
        <CelularFormDialog
          key={`pasar-${pasando.id}`}
          celular={null}
          variantes={stock.variantes}
          unidades={stock.celulares}
          open
          onClose={() => setPasando(null)}
          puedeVerCosto
          modoCompra
          inicial={(() => {
            const eq = equipoDeCanje(pasando);
            return {
              modelo: eq.modelo,
              color: eq.color,
              imei: pasando.imei ?? "",
              condicion: eq.condicion || "A",
              bateria: eq.bateria ?? 100,
              costoUsd: pasando.totalUsd,
            };
          })()}
          textos={{
            titulo: `Pasar al stock · ${pasando.id}`,
            descripcion:
              "Elegí la variante del equipo. Entra al inventario con el costo del canje (lo que se le reconoció al cliente).",
            boton: "Pasar al stock",
          }}
          onVarianteCreada={() => router.refresh()}
          onSubmit={async (input) => {
            const compraId = pasando.id;
            const res = await pasarCanjeAlStockAction(compraId, input);
            if (!res.ok) {
              setErrorPasar(res.error);
              return;
            }
            setErrorPasar(null);
            setList((prev) =>
              prev.map((c) => (c.id === compraId ? { ...c, celularId: res.celularId } : c)),
            );
            router.refresh();
          }}
        />
      )}

      <NuevaCompraDialog
        key={creating ? `n-${varianteInicial ?? ""}` : "n0"}
        open={creating}
        onClose={() => {
          setCreating(false);
          setVarianteInicial(null);
        }}
        onCreate={(c) => {
          setList((prev) => [c, ...prev]);
          setCreating(false);
          setVarianteInicial(null);
          if (c.subeStock) {
            setVista("ingresos");
            router.refresh();
          }
        }}
        cajas={cajas}
        stock={stock}
        varianteInicialId={varianteInicial}
      />
    </SeccionTabla>
  );
}

function CompraDetalle({ compra, ingresos }: { compra: Compra; ingresos: IngresoStock[] }) {
  const metaFields = [
    {
      label: compra.origen === "canje" ? "Proveedor (cliente del canje)" : "Proveedor",
      value: contraparteDe(compra),
    },
    { label: "Fecha", value: compra.fecha },
    { label: "Medio de pago", value: medioPagoCfg[compra.medioPago].label },
    { label: "Estado", value: compraEstado[compra.estado].label },
    ...(compra.origen === "proveedor"
      ? [{ label: "Stock", value: compra.subeStock ? "Ingresó al stock" : "No sube al stock" }]
      : [{ label: "Stock", value: compra.celularId ? "En el stock" : "Sin ingresar" }]),
    ...(compra.costosAdicionalesUsd
      ? [{ label: "Costos adicionales", value: fmtUsd(compra.costosAdicionalesUsd) }]
      : []),
    ...(compra.montoArs != null
      ? [
          { label: "Monto pagado", value: fmtArs(compra.montoArs) },
          { label: "Cotización", value: fmtArs(compra.cotizacion ?? 0) },
        ]
      : []),
  ];
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Información general
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metaFields.map((f) => (
            <Card key={f.label} className="p-2 text-center">
              <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                {f.label}
              </p>
              <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">{f.value}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Ítems
        </p>
        <Card className="divide-y divide-neutral-100 overflow-hidden md:hidden">
          {compra.items.map((i, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-neutral-900">
                {i.detalle}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-neutral-400">×{i.cantidad}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {fmtUsd(i.cantidad * i.costoUsd)}
              </span>
            </div>
          ))}
          <div
            className="flex items-center justify-between gap-2 px-3 py-2"
            style={{ backgroundColor: "var(--accent-soft)" }}
          >
            <span className="text-sm font-semibold uppercase tracking-wide text-neutral-900">
              Total
            </span>
            <span className="text-sm font-semibold tabular-nums">{fmtUsd(compra.totalUsd)}</span>
          </div>
        </Card>
        <div className="hidden overflow-hidden rounded-xl border border-neutral-200 md:block">
          <table className="w-full text-sm [&_td]:text-center [&_th]:text-center">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                <th className={cn("px-4 py-2 text-center", thDivider)}>Detalle</th>
                <th className={cn("px-4 py-2", thDivider)}>Cant</th>
                <th className={cn("px-4 py-2", thDivider)}>Costo unit.</th>
                <th className="px-4 py-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {compra.items.map((i, idx) => (
                <tr key={idx} className="border-t border-neutral-100 first:border-t-0">
                  <td className="px-4 py-2.5 !text-start">{i.detalle}</td>
                  <td className="px-4 py-2.5 tabular-nums">{i.cantidad}</td>
                  <td className="px-4 py-2.5 tabular-nums text-neutral-500">{fmtUsd(i.costoUsd)}</td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums">
                    {fmtUsd(i.cantidad * i.costoUsd)}
                  </td>
                </tr>
              ))}
              <tr
                className="border-t border-neutral-100 font-semibold text-neutral-900"
                style={{ backgroundColor: "var(--accent-soft)", backgroundImage: "none" }}
              >
                <td className="px-4 py-2.5 !text-start uppercase tracking-wide" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-2.5 tabular-nums">{fmtUsd(compra.totalUsd)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {compra.notas && (
        <p className="text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900">Notas: </span>
          {compra.notas}
        </p>
      )}

      {ingresos.length > 0 && (
        <div>
          <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Ingresó al stock
          </p>
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {ingresos.map((i) => {
              const href = hrefDeIngreso(i);
              return (
                <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {i.detalle}
                    {i.serie && (
                      <span className="ml-2 font-mono text-xs text-neutral-500">{i.serie}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-500">×{i.cantidad}</span>
                  {href && (
                    <a href={href} className="shrink-0 text-xs font-semibold text-accent hover:underline">
                      Ver en inventario
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {compra.origen === "canje" && (
        <div>
          <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Información del equipo
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(() => {
              const eq = equipoDeCanje(compra);
              return [
                { label: "Modelo", value: eq.modelo },
                { label: "IMEI / serial", value: compra.imei || "—" },
                { label: "Color", value: eq.color || "—" },
                { label: "Estado", value: eq.condicion || "—" },
                {
                  label: "Batería",
                  value:
                    eq.condicion === "NUEVO" ? "No aplica" : eq.bateria !== undefined ? `${eq.bateria} %` : "—",
                },
                { label: "Precio de compra", value: fmtUsd(compra.totalUsd) },
                { label: "Testeo", value: compra.checklist ? "Hecho" : "No se hizo" },
                { label: "Venta", value: compra.ventaId ?? "—" },
              ];
            })().map((f) => (
              <Card key={f.label} className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  {f.label}
                </p>
                <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">{f.value}</p>
              </Card>
            ))}
          </div>
          {compra.celularId && (
            <a
              href={`/inventario?tab=celulares&celular=${compra.celularId}`}
              className="mt-3 inline-block text-xs font-semibold text-accent hover:underline"
            >
              Ver celular en inventario
            </a>
          )}
          {compra.checklist && (
            <div className="mt-3">
              <ReciboChecklist
                titulo="Checklist de ingreso"
                checklist={compra.checklist}
                ocultarColor
              />
            </div>
          )}
          {compra.aclaraciones && (
            <p className="mt-3 text-sm text-neutral-600">
              <span className="font-semibold text-neutral-900">Detalles: </span>
              {compra.aclaraciones}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function IngresosTabla({
  ingresos,
  onOpenCompra,
}: {
  ingresos: IngresoStock[];
  onOpenCompra: (compraId: string) => void;
}) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs">
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Compra</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Producto</th>
            <th className="px-4 py-3">IMEI / serie</th>
            <th className="px-4 py-3">Cant.</th>
            <th className="px-4 py-3">Costo unit.</th>
            <th className="px-4 py-3">Proveedor</th>
            <th className="px-4 py-3">Usuario</th>
          </tr>
        </thead>
        <tbody>
          {ingresos.map((i) => {
            const href = hrefDeIngreso(i);
            const Icono = TIPO_ICONO[i.tipo];
            return (
              <tr
                key={i.id}
                onClick={() => onOpenCompra(i.compraId)}
                className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
              >
                <td className="whitespace-nowrap px-4 py-2 tabular-nums">{i.fecha}</td>
                <td className="px-4 py-2 font-medium text-neutral-500">{i.compraId}</td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    <Icono className="h-3.5 w-3.5" aria-hidden />
                    {TIPO_ITEM_COMPRA_LABEL[i.tipo]}
                  </span>
                </td>
                <td className="px-4 py-2 text-start">
                  {href ? (
                    <a
                      href={href}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-accent hover:underline"
                    >
                      {i.detalle}
                    </a>
                  ) : (
                    i.detalle
                  )}
                </td>
                <td className="max-w-[180px] truncate px-4 py-2 font-mono text-xs text-neutral-600">
                  {i.serie || "—"}
                </td>
                <td className="px-4 py-2 tabular-nums">{i.cantidad}</td>
                <td className="px-4 py-2 tabular-nums">{fmtUsd(i.costoUsd)}</td>
                <td className="px-4 py-2 text-start">{i.proveedor || "—"}</td>
                <td className="px-4 py-2">{i.usuario || "—"}</td>
              </tr>
            );
          })}
          {ingresos.length === 0 && (
            <tr>
              <td colSpan={9} className="px-5 py-10 text-center text-sm text-neutral-500">
                Sin ingresos. Cargá una compra con «Subir al stock» para que aparezcan acá.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

const nombreCelular = (c: { modelo: string; almacenamiento: string; color: string }) =>
  [c.modelo, c.almacenamiento, c.color && c.color !== "—" ? c.color : ""].filter(Boolean).join(" ");

function NuevaCompraDialog({
  open,
  onClose,
  onCreate,
  cajas,
  stock,
  varianteInicialId,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (c: Compra) => void;
  cajas: Caja[];
  stock: StockParaCompra;
  varianteInicialId?: string | null;
}) {
  const [proveedor, setProveedor] = useState("");
  // Medio y caja salen de las cajas reales (mismo criterio que el pago de
  // Ventas): solo se ofrecen los medios con alguna caja activa, y la caja
  // dice la moneda. «Registrar movimiento» decide si la compra genera el
  // egreso en esa caja (sin tildar: equipo propio, pago fuera del sistema).
  const cajasActivas = cajas.filter((c) => c.activa);
  const mediosConCaja = MEDIOS.filter((m) => cajasActivas.some((c) => c.medioPago === m));
  const mediosSinCaja = MEDIOS.filter((m) => !mediosConCaja.includes(m));
  const [medioPago, setMedioPago] = useState<MedioPago>(
    cajasActivas[0]?.medioPago ?? "transferencia",
  );
  const cajasDelMedio = cajasActivas.filter((c) => c.medioPago === medioPago);
  const [cajaId, setCajaId] = useState<string | null>(cajasDelMedio[0]?.id ?? null);
  const cajaElegida = cajasDelMedio.find((c) => c.id === cajaId) ?? null;
  const [registrarMovimiento, setRegistrarMovimiento] = useState(cajasActivas.length > 0);
  const mueveCaja = registrarMovimiento && !!cajaElegida;
  const pagaEnArs = mueveCaja && cajaElegida?.moneda === "ars";
  const [subeStock, setSubeStock] = useState(true);
  const [items, setItems] = useState<CompraItem[]>([{ detalle: "", cantidad: 1, costoUsd: 0 }]);
  const [carrito, setCarrito] = useState<ItemCompraStock[]>([]);
  const [adicional, setAdicional] = useState(0);
  const [notas, setNotas] = useState("");
  const [variantes, setVariantes] = useState(stock.variantes);
  const varianteInicial = variantes.find((v) => v.id === varianteInicialId) ?? null;
  const [agregando, setAgregando] = useState<TipoItemCompra | null>(
    varianteInicial ? (varianteInicial.categoria === "notebook" ? "notebook" : "celular") : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dolarVenta = useDolar().venta;

  const totalLibre = items.reduce((a, i) => a + i.cantidad * i.costoUsd, 0);
  const itemsValidos = items.filter((i) => i.detalle.trim() && i.cantidad > 0);
  const resumen = resumenCompraStock(carrito, adicional);
  const adicionales = prorratearCostos(carrito, adicional);
  const total = subeStock ? resumen.totalUsd : totalLibre;
  const seriesEnStock = useMemo(
    () => [
      ...stock.celulares.map((c) => c.imei).filter((x) => x && x !== "—"),
      ...stock.notebooks.map((n) => n.numeroSerie).filter(Boolean),
    ],
    [stock.celulares, stock.notebooks],
  );
  const erroresStock = subeStock && carrito.length > 0 ? erroresCompraStock(carrito, seriesEnStock) : [];
  // Toda compra lleva proveedor (también las que suben al stock).
  const valid =
    !!proveedor.trim() &&
    (subeStock
      ? carrito.length > 0 && erroresStock.length === 0
      : itemsValidos.length > 0 && totalLibre > 0);

  const agregar = (it: ItemCompraStock) => setCarrito((p) => [...p, it]);
  const updateItem = (idx: number, patch: Partial<CompraItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  function submit() {
    setError(null);
    const totalUsd = subeStock ? resumen.totalUsd : itemsValidos.reduce((a, i) => a + i.cantidad * i.costoUsd, 0);
    startTransition(async () => {
      const res = await createCompraAction({
        proveedor: proveedor.trim(),
        items: subeStock ? [] : itemsValidos,
        totalUsd,
        medioPago,
        ...(mueveCaja && cajaId ? { cajaId } : {}),
        ...(pagaEnArs ? { montoArs: Math.round(totalUsd * dolarVenta), cotizacion: dolarVenta } : {}),
        ...(subeStock ? { stock: carrito, costosAdicionalesUsd: adicional } : {}),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreate(res.compra);
    });
  }

  const botonesTipo: { tipo: TipoItemCompra; label: string }[] = [
    { tipo: "celular", label: "Celular" },
    { tipo: "notebook", label: "Notebook" },
    { tipo: "repuesto", label: "Repuesto" },
    { tipo: "otro", label: "Otro producto" },
  ];

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      size="4xl"
      title="Nueva compra"
      formulario
      description="Se asigna un número al confirmar"
      footer={
        <>
          <Button onClick={onClose} variant="outline" fullOnMobile>
            Cancelar
          </Button>
          <Button disabled={!valid} loading={pending} onClick={submit} variant="primary" fullOnMobile>
            {subeStock ? "Guardar y subir al stock" : "Registrar compra"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Datos de la compra
          </p>
          <GrillaCampos>
            <Field label="Proveedor">
              <Input
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Ej. Tecno Import"
              />
            </Field>
            <Field label="Medio de pago">
              <Select
                value={medioPago}
                onChange={(e) => {
                  const medio = e.target.value as MedioPago;
                  setMedioPago(medio);
                  setCajaId(cajasActivas.find((c) => c.medioPago === medio)?.id ?? null);
                }}
                disabled={mediosConCaja.length === 0}
              >
                {mediosConCaja.length === 0 && <option value={medioPago}>Sin cajas activas</option>}
                {mediosConCaja.map((m) => (
                  <option key={m} value={m}>
                    {medioPagoCfg[m].emoji} {medioPagoCfg[m].label}
                  </option>
                ))}
                {mediosSinCaja.map((m) => (
                  <option key={m} value={m} disabled>
                    {medioPagoCfg[m].emoji} {medioPagoCfg[m].label} (sin caja)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Caja">
              <Select
                value={cajaId ?? ""}
                onChange={(e) => setCajaId(e.target.value || null)}
                disabled={cajasDelMedio.length === 0}
              >
                {cajasDelMedio.length === 0 && <option value="">—</option>}
                {cajasDelMedio.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} · {c.moneda === "ars" ? "$" : "U$"}
                  </option>
                ))}
              </Select>
            </Field>
          </GrillaCampos>
          <label className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[13px] font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={mueveCaja}
              disabled={!cajaElegida}
              onChange={(e) => setRegistrarMovimiento(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
            />
            Registrar movimiento
            <span className="text-[11px] font-normal text-neutral-500">
              {mueveCaja && cajaElegida
                ? "(se registra el egreso en «" + cajaElegida.nombre + "» al guardar)"
                : "(la compra no mueve plata de ninguna caja)"}
            </span>
          </label>
          {mediosSinCaja.length > 0 && (
            <p className="mt-1 text-center text-[11px] text-neutral-500">
              ¿No aparece cómo pagaste? Cada forma de pago es una caja: creala en{" "}
              <a
                href="/cajas"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent hover:underline"
              >
                Cajas
              </a>{" "}
              con su medio y su moneda.
            </p>
          )}
          <label className="mt-3 flex items-center justify-center gap-2 text-[13px] font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={subeStock}
              onChange={(e) => setSubeStock(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
            />
            Subir al stock
            <span className="text-[11px] font-normal text-neutral-500">
              (los productos se cargan en Inventario al guardar)
            </span>
          </label>
        </section>

        {subeStock ? (
          <section className="border-t border-neutral-200 pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Productos
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {botonesTipo.map(({ tipo, label }) => (
                <Button key={tipo} icon={TIPO_ICONO[tipo]} variant="tonal" onClick={() => setAgregando(tipo)}>
                  {label}
                </Button>
              ))}
            </div>

            {carrito.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs">
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2">IMEI / serie</th>
                      <th className="px-3 py-2">Cant.</th>
                      <th className="px-3 py-2">Costo unit.</th>
                      <th className="px-3 py-2">Costo final</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.map((it, idx) => (
                      <tr key={idx} className="border-t border-neutral-100">
                        <td className="px-3 py-2">{TIPO_ITEM_COMPRA_LABEL[it.tipo]}</td>
                        <td className="px-3 py-2 !text-start">{it.detalle}</td>
                        <td className="px-3 py-2 font-mono text-xs">{serieDeItem(it) || "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{it.cantidad}</td>
                        <td className="px-3 py-2 tabular-nums">{fmtUsd(it.costoUsd)}</td>
                        <td className="px-3 py-2 font-semibold tabular-nums">
                          {fmtUsd(costoFinalUnitario(it, adicionales[idx] ?? 0))}
                        </td>
                        <td className="px-2 py-1">
                          <IconButton
                            aria-label={`Quitar ${it.detalle}`}
                            icon={Trash2}
                            variant="danger-ghost"
                            size="sm"
                            onClick={() => setCarrito((p) => p.filter((_, i) => i !== idx))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">
                Agregá los productos de la compra con los botones de arriba.
              </p>
            )}

            {erroresStock.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-red-600">
                {erroresStock.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}

            <GrillaCampos className="mt-4">
              <Field label="Costos adicionales (USD)">
                <Input
                  type="number"
                  min={0}
                  value={adicional || ""}
                  placeholder="0"
                  onChange={(e) => setAdicional(Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
              <Field label="Notas" className="sm:col-span-2">
                <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Envío, factura, etc." />
              </Field>
            </GrillaCampos>
            <p className="mt-1.5 text-[11px] text-neutral-500">
              Envío, flete o comisiones: se reparten entre los productos según su costo.
            </p>
          </section>
        ) : (
          <section className="border-t border-neutral-200 pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Ítems
            </p>
            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[minmax(0,1fr)_5rem_minmax(0,8rem)_auto] items-end gap-2.5 max-sm:grid-cols-[5rem_minmax(0,1fr)_auto] max-sm:rounded-lg max-sm:border max-sm:border-neutral-200 max-sm:p-2.5"
                >
                  <Field label="Detalle" className="max-sm:col-span-3">
                    <Input
                      value={item.detalle}
                      onChange={(e) => updateItem(idx, { detalle: e.target.value })}
                      placeholder="Ej. Herramientas, insumos"
                    />
                  </Field>
                  <Field label="Cant.">
                    <Input
                      type="number"
                      min={1}
                      value={item.cantidad || ""}
                      onChange={(e) => updateItem(idx, { cantidad: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Costo unit. (USD)">
                    <Input
                      type="number"
                      min={0}
                      value={item.costoUsd || ""}
                      onChange={(e) => updateItem(idx, { costoUsd: Number(e.target.value) })}
                    />
                  </Field>
                  <IconButton
                    aria-label="Quitar ítem"
                    icon={Trash2}
                    variant="danger-ghost"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={items.length === 1}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-center">
              <Button
                icon={Plus}
                onClick={() => setItems((prev) => [...prev, { detalle: "", cantidad: 1, costoUsd: 0 }])}
                variant="tonal"
              >
                Agregar ítem
              </Button>
            </div>
            <Field label="Notas" className="mt-3">
              <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
            </Field>
          </section>
        )}

        <div className="flex justify-end">
          <div className="flex items-baseline gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Total</span>
            <span className="text-end">
              <span className="block text-base font-semibold tabular-nums">{fmtUsd(total)}</span>
              {subeStock && resumen.adicionalUsd > 0 && (
                <span className="block text-[11px] font-normal tabular-nums text-neutral-500">
                  {fmtUsd(resumen.subtotalUsd)} + {fmtUsd(resumen.adicionalUsd)} adicionales
                </span>
              )}
              {pagaEnArs && (
                <span className="block text-[11px] font-normal tabular-nums text-neutral-500">
                  {fmtArs(Math.round(total * dolarVenta))} · cotización {fmtArs(dolarVenta)}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </Dialog>

    <CelularFormDialog
      key={agregando === "celular" ? `cc-${carrito.length}` : "cc0"}
      modoCompra
      celular={null}
      variantes={variantes}
      unidades={stock.celulares}
      varianteInicialId={varianteInicial?.categoria === "celular" ? varianteInicial.id : null}
      open={agregando === "celular"}
      onClose={() => setAgregando(null)}
      onVarianteCreada={(v) => setVariantes((p) => [...p, v])}
      puedeVerCosto
      onSubmit={(data) =>
        agregar({ tipo: "celular", detalle: nombreCelular(data), cantidad: 1, costoUsd: data.costoUsd, celular: data })
      }
    />
    <NotebookFormDialog
      key={agregando === "notebook" ? `cn-${carrito.length}` : "cn0"}
      modoCompra
      notebook={null}
      variantes={variantes}
      unidades={stock.notebooks}
      varianteInicialId={varianteInicial?.categoria === "notebook" ? varianteInicial.id : null}
      open={agregando === "notebook"}
      onClose={() => setAgregando(null)}
      onVarianteCreada={(v) => setVariantes((p) => [...p, v])}
      puedeVerCosto
      onSubmit={(data) =>
        agregar({
          tipo: "notebook",
          detalle: [data.modelo, data.memoria, data.almacenamiento].filter(Boolean).join(" "),
          cantidad: 1,
          costoUsd: data.costoUsd,
          notebook: data,
        })
      }
    />
    <IngresoDialog
      key={agregando === "repuesto" ? `cr-${carrito.length}` : "cr0"}
      modoCompra
      open={agregando === "repuesto"}
      onClose={() => setAgregando(null)}
      titulo="repuesto"
      existentes={stock.repuestos.map((r) => ({ id: r.id, label: `${r.nombre} · ${r.modelo}` }))}
      onIngreso={(id, cantidad, precio) => {
        const r = stock.repuestos.find((x) => x.id === id);
        agregar({ tipo: "repuesto", detalle: r?.nombre ?? "Repuesto", cantidad, costoUsd: precio, repuestoId: id });
      }}
      onNuevo={(nombre, precio, cantidad) =>
        agregar({ tipo: "repuesto", detalle: nombre, cantidad, costoUsd: precio, nombre })
      }
    />
    <IngresoDialog
      key={agregando === "otro" ? `co-${carrito.length}` : "co0"}
      modoCompra
      open={agregando === "otro"}
      onClose={() => setAgregando(null)}
      titulo="producto"
      categoria
      existentes={stock.otros.map((o) => ({ id: o.id, label: o.nombre, serializado: o.serializado }))}
      onIngreso={(id, cantidad, precio, unidades) => {
        const o = stock.otros.find((x) => x.id === id);
        agregar({ tipo: "otro", detalle: o?.nombre ?? "Producto", cantidad, costoUsd: precio, otroId: id, unidades });
      }}
      onNuevo={(nombre, precio, cantidad, cat, unidades, precioVenta) =>
        agregar({
          tipo: "otro",
          detalle: nombre,
          cantidad,
          costoUsd: precio,
          nuevo: { nombre, categoria: cat ?? "accesorio", precioVenta: precioVenta ?? 0 },
          unidades,
        })
      }
    />
    </>
  );
}
