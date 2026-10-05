"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Trash2, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
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
import { gastoPorMes, gastoPorProveedor, resumenCompras } from "@/lib/compras";
import type { Caja, Compra, CompraEstado, CompraItem, MedioPago } from "@/lib/types";
import type { Negocio } from "@/lib/db/configuracion";
import type { SessionUser } from "@/lib/auth/types";
import { createCompraAction, marcarRecibidaAction, deleteCompraAction } from "./actions";

const MEDIOS = MEDIOS_CAJA;

/** Nombre de la contraparte -- proveedor de siempre, o el cliente cuando
 * es un canje recibido en una venta (`origen === "canje"`, ver "Ventas" en
 * CLAUDE.md). */
function contraparteDe(c: Compra) {
  return c.origen === "canje" ? (c.cliente ?? "") : (c.proveedor ?? "");
}

function matchesQuery(c: Compra, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (contraparteDe(c).toLowerCase().includes(needle)) return true;
  return c.items.some((i) => i.detalle.toLowerCase().includes(needle));
}

export function ComprasClient({
  initialCompras,
  user,
  negocio,
  cajas,
}: {
  initialCompras: Compra[];
  user: SessionUser;
  negocio: Negocio;
  cajas: Caja[];
}) {
  const { publish } = useRealtime();
  const esAdmin = user.rol === "admin";
  const [list, setList] = useState<Compra[]>(initialCompras);
  const openParam = useSearchParams().get("open");
  const [estadoFiltro, setEstadoFiltro] = useState<"todos" | CompraEstado>("todos");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(openParam);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [eliminarMovimientoCaja, setEliminarMovimientoCaja] = useState(true);
  const [recibo, setRecibo] = useState(false);
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const router = useRouter();

  // ?accion=nueva-compra: el buscador global (CommandPalette) navega acá con
  // ese param. Efecto aparte del openParam de arriba (no tocarlo) y no un
  // useState inicial, para que también funcione estando ya parado en
  // /compras -- el componente no se remonta en la misma ruta.
  useEffect(() => {
    if (searchParams.get("accion") !== "nueva-compra") return;
    setCreating(true);
    router.replace("/compras"); // limpia el param -- evita reabrir con back/refresh
  }, [searchParams, router]);

  const filtered = useMemo(
    () =>
      list.filter(
        (c) => (estadoFiltro === "todos" || c.estado === estadoFiltro) && matchesQuery(c, q),
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
    startTransition(async () => {
      await deleteCompraAction(id, borrarMovimiento);
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
          contadorFiltros={(estadoFiltro !== "todos" ? 1 : 0) + (q ? 1 : 0)}
          busqueda={
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por proveedor o ítem…"
                className={cn("w-full pl-9", filterPill)}
                aria-label="Buscar compras"
              />
            </div>
          }
          filtros={
            <Select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value as "todos" | CompraEstado)}
              className={cn("w-full sm:w-44", filterPill)}
              aria-label="Filtrar por estado"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="recibida">Recibida</option>
            </Select>
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
                <td className="px-5 py-2 text-center font-medium">{contraparteDe(c)}</td>
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
        {open && <CompraDetalle compra={open} />}
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
        >
          <ReciboCampos
            filas={[
              ["Marca", open.marca || "—"],
              ["Modelo", open.items[0]?.detalle ?? "—"],
              ["Serial / IMEI", open.imei || "—"],
              ["Color", open.checklist?.color || "—"],
            ]}
          />
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
          <ReciboNota titulo="Aclaraciones" texto={open.aclaraciones ?? ""} />
        </ReciboImprimir>
      )}

      <NuevaCompraDialog
        key={creating ? "n" : "n0"}
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(c) => {
          setList((prev) => [c, ...prev]);
          setCreating(false);
        }}
        cajas={cajas}
      />
    </SeccionTabla>
  );
}

function CompraDetalle({ compra }: { compra: Compra }) {
  const metaFields = [
    {
      label: compra.origen === "canje" ? "Cliente" : "Proveedor",
      value: contraparteDe(compra),
    },
    { label: "Fecha", value: compra.fecha },
    { label: "Medio de pago", value: medioPagoCfg[compra.medioPago].label },
    { label: "Estado", value: compraEstado[compra.estado].label },
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
                <th className={cn("px-4 py-2 !text-start", thDivider)}>Detalle</th>
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

      {compra.origen === "canje" && (
        <div>
          <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Información del equipo
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Marca", value: compra.marca || "—" },
              { label: "Serial / IMEI", value: compra.imei || "—" },
              { label: "Color", value: compra.checklist?.color || "—" },
              { label: "Venta", value: compra.ventaId ?? "—" },
            ].map((f) => (
              <Card key={f.label} className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  {f.label}
                </p>
                <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">{f.value}</p>
              </Card>
            ))}
          </div>
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
              <span className="font-semibold text-neutral-900">Aclaraciones: </span>
              {compra.aclaraciones}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function NuevaCompraDialog({
  open,
  onClose,
  onCreate,
  cajas,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (c: Compra) => void;
  cajas: Caja[];
}) {
  const [proveedor, setProveedor] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago>("transferencia");
  // Cajas activas del medio elegido -- mismo criterio que el pago de Ventas:
  // un medio puede tener más de una caja, hay que saber cuál. Si no hay
  // ninguna, la compra se registra igual (sin movimiento de caja).
  const cajasDelMedio = cajas.filter((c) => c.activa && c.medioPago === medioPago);
  const [cajaId, setCajaId] = useState<string | null>(cajasDelMedio[0]?.id ?? null);
  const cajaElegida = cajasDelMedio.find((c) => c.id === cajaId) ?? null;
  const pagaEnArs = cajaElegida?.moneda === "ars";
  const [items, setItems] = useState<CompraItem[]>([{ detalle: "", cantidad: 1, costoUsd: 0 }]);
  const [pending, startTransition] = useTransition();
  const dolarVenta = useDolar().venta;

  const total = items.reduce((a, i) => a + i.cantidad * i.costoUsd, 0);
  const itemsValidos = items.filter((i) => i.detalle.trim() && i.cantidad > 0);
  const valid = !!proveedor.trim() && itemsValidos.length > 0 && total > 0;

  const updateItem = (idx: number, patch: Partial<CompraItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  function submit() {
    const totalUsd = itemsValidos.reduce((a, i) => a + i.cantidad * i.costoUsd, 0);
    startTransition(async () => {
      const compra = await createCompraAction({
        proveedor: proveedor.trim(),
        items: itemsValidos,
        totalUsd,
        medioPago,
        ...(cajaId ? { cajaId } : {}),
        ...(medioPago === "pesos" || pagaEnArs
          ? { montoArs: Math.round(totalUsd * dolarVenta), cotizacion: dolarVenta }
          : {}),
      });
      onCreate(compra);
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="3xl"
      title="Nueva compra"
      description="Se asigna un número al confirmar"
      footer={
        <>
          <Button
            onClick={onClose}
            variant="outline" fullOnMobile
          >
            Cancelar
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={submit}
            variant="primary" fullOnMobile
          >
            {pending ? "Registrando…" : "Registrar compra"}
          </Button>
        </>
      }
    >
      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
        <div
          className={cn(
            "grid gap-3",
            cajasDelMedio.length > 0 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2",
          )}
        >
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
                setCajaId(cajas.find((c) => c.activa && c.medioPago === medio)?.id ?? null);
              }}
            >
              {MEDIOS.map((m) => (
                <option key={m} value={m}>
                  {medioPagoCfg[m].label}
                </option>
              ))}
            </Select>
          </Field>
          {cajasDelMedio.length > 0 && (
            <Field label="Caja">
              <Select value={cajaId ?? ""} onChange={(e) => setCajaId(e.target.value)}>
                {cajasDelMedio.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <div className="lg:row-span-2">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Ítems
          </p>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <Field label="Detalle" className="flex-1">
                  <Input
                    value={item.detalle}
                    onChange={(e) => updateItem(idx, { detalle: e.target.value })}
                    placeholder="Ej. Pantalla OLED iPhone 13"
                  />
                </Field>
                <Field label="Cant." className="w-20">
                  <Input
                    type="number"
                    min={1}
                    value={item.cantidad || ""}
                    onChange={(e) => updateItem(idx, { cantidad: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Costo unit. (USD)" className="w-32">
                  <Input
                    type="number"
                    min={0}
                    value={item.costoUsd || ""}
                    onChange={(e) => updateItem(idx, { costoUsd: Number(e.target.value) })}
                  />
                </Field>
                <button
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:pointer-events-none disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <Button icon={Plus}
            onClick={() => setItems((prev) => [...prev, { detalle: "", cantidad: 1, costoUsd: 0 }])}
            variant="tonal"
          >
            Agregar ítem
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
          <span className="font-medium text-neutral-500">Total</span>
          <span className="text-end">
            <span className="block font-semibold tabular-nums">{fmtUsd(total)}</span>
            {(medioPago === "pesos" || pagaEnArs) && (
              <span className="block text-[11px] font-normal text-neutral-400">
                {fmtArs(Math.round(total * dolarVenta))} · cotización {fmtArs(dolarVenta)}
              </span>
            )}
          </span>
        </div>
      </div>
    </Dialog>
  );
}
