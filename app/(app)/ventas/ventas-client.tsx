"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  Check,
  FileText,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { SeccionTabla } from "@/components/ui/seccion-tabla";
import {
  GraficoBarrasVerticales,
  GraficoDona,
} from "@/components/seccion/graficos";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChecklistEditor, CHECKLIST_VACIO } from "@/components/ui/checklist-editor";
import {
  ReciboImprimir,
  ReciboLineas,
  ReciboGarantiaItems,
  ReciboNota,
  ReciboNotaLista,
  type ReciboPagina,
} from "@/components/recibos/recibo";
import { medioPago as medioPagoCfg, dotClass, MEDIOS_CAJA } from "@/lib/status";
import { fmtUsd, fmtArs, fmtNum, fmtDateSlash } from "@/lib/format";
import { otroCostoPromedio } from "@/lib/otros";
import {
  calcularMargenPct,
  calcularRestante,
  saldarUltimoPago,
  montoConRecargo,
  montoPagoLabel,
  margenVenta,
  categoriaDe,
  motivoNoConfirmable,
  RUBRO_LABEL,
  type ResumenVentas,
  type GraficosVentas,
} from "@/lib/ventas";
import {
  DATE_PRESETS,
  type DatePreset,
} from "@/lib/date-presets";
import {
  hayFiltrosActivos,
  queryDeFiltros,
  type FiltrosVentas,
  type SortVentas,
} from "@/lib/ventas-filtros";
import { useDolar } from "@/lib/dolar";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import type { DeleteVentaOpts, ItemVendido } from "@/lib/db/ventas";
import type {
  Caja,
  CanjeEquipo,
  Checklist,
  ClienteOpcion,
  ClienteSeleccion,
  Equipo,
  MedioPago,
  MedioPagoVenta,
  ModalidadVenta,
  OtroItem,
  Pago,
  Repuesto,
  Servicio,
  Venta,
  VentaItem,
} from "@/lib/types";
import type { Negocio } from "@/lib/db/configuracion";
import type { SessionUser } from "@/lib/auth/types";
import { ClientePicker } from "@/components/ui/cliente-picker";
import { useOutsideClick } from "@/components/ui/use-outside-click";
import { createVentaAction, deleteVentaAction } from "./actions";

const PROCEDENCIAS = [
  "Local",
  "WhatsApp",
  "Instagram",
  "MercadoLibre",
  "Referido",
  "Otro",
];

const MODALIDAD_LABEL: Record<ModalidadVenta, string> = {
  minorista: "Minorista",
  mayorista: "Mayorista",
};

/** Costo/ganancia/margen de una venta ya guardada, sobre los ítems con costo
 * cargado (`margenVenta`). "—" cuando ningún ítem tiene costo. */
function ventaCostoLabel(v: Venta): string {
  const m = margenVenta(v.items);
  return m.margenPct === null ? "—" : fmtUsd(m.costoUsd);
}

function ventaGananciaLabel(v: Venta): string {
  const m = margenVenta(v.items);
  return m.margenPct === null ? "—" : fmtUsd(m.gananciaUsd);
}

function ventaMargenLabel(v: Venta): string {
  const m = margenVenta(v.items);
  return m.margenPct === null ? "—" : `${m.margenPct.toFixed(1)}%`;
}

function itemMargenLabel(i: VentaItem): string {
  return i.costoUsd !== undefined
    ? `${calcularMargenPct(i.precioUsd, i.costoUsd).toFixed(1)}%`
    : "—";
}

/** Pago principal (el de mayor monto) + "+N" si hay más. */
function pagoPrincipal(pagos: Pago[]): { pago: Pago; extra: number } | null {
  if (pagos.length === 0) return null;
  const pago = pagos.reduce((a, b) => (b.montoUsd > a.montoUsd ? b : a), pagos[0]);
  return { pago, extra: pagos.length - 1 };
}

function pagoResumen(pagos: Pago[]): string {
  return pagos
    .map((p) => `${medioPagoCfg[p.medio].label} ${montoPagoLabel(p)}`)
    .join(" · ");
}

/** Fila de pago en el detalle -- reusada en la tarjeta mobile. */
function PagoChip({ pagos }: { pagos: Pago[] }) {
  const principal = pagoPrincipal(pagos);
  if (!principal) return <span className="text-xs text-neutral-500">—</span>;
  return (
    <span
      title={pagoResumen(pagos)}
      className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          dotClass[medioPagoCfg[principal.pago.medio].tone],
        )}
      />
      {medioPagoCfg[principal.pago.medio].label}
      {principal.extra > 0 && (
        <span className="font-normal text-neutral-500">+{principal.extra}</span>
      )}
    </span>
  );
}

type PersonaOpcion = { id: string; nombre: string };

/** Payload de "Nueva venta" -- el mismo que recibe `createVentaAction`. Se
 * expone para que la demo pueda inyectar su propia implementación. */
export type CrearVentaInput = {
  cliente: Exclude<ClienteSeleccion, { tipo: "libre" }>;
  vendedorId: string;
  vendedorNombre: string;
  procedencia?: string;
  modalidad: ModalidadVenta;
  items: VentaItem[];
  totalUsd: number;
  pagos: (Pago & { canje?: CanjeEquipo })[];
  margenPct: number;
  tipo: "venta" | "reparacion";
  dolarVenta: number;
};

/** Mutaciones de Ventas inyectables: por defecto van a las server actions
 * reales; la demo (`/demo/ventas`) pasa las suyas contra el store local. */
export type AccionesVentas = {
  crearVenta: (input: CrearVentaInput) => Promise<Venta>;
  eliminarVenta: (id: string, opts: DeleteVentaOpts) => Promise<void>;
  refrescar: () => void;
};

export function VentasClient({
  filtros,
  contexto,
  deltaHint,
  resumen,
  resumenAnterior,
  graficos,
  ventas,
  totalVentas,
  items,
  totalItems,
  openId,
  ventaAbierta,
  clientesOpciones,
  equipos,
  otros,
  servicios,
  repuestos,
  vendedores,
  cajas,
  negocio,
  user,
  basePath = "/ventas",
  modoDemo = false,
  acciones,
}: {
  filtros: FiltrosVentas;
  contexto: string;
  deltaHint: string;
  resumen: ResumenVentas;
  resumenAnterior: ResumenVentas | null;
  graficos: GraficosVentas;
  ventas: Venta[];
  totalVentas: number;
  items: ItemVendido[];
  totalItems: number;
  openId: string | null;
  ventaAbierta: Venta | null;
  clientesOpciones: ClienteOpcion[];
  equipos: Equipo[];
  otros: OtroItem[];
  servicios: Servicio[];
  repuestos: Repuesto[];
  vendedores: PersonaOpcion[];
  cajas: Caja[];
  negocio: Negocio;
  user: SessionUser;
  /** Base de las URLs de filtros/deep-links (default `/ventas`). */
  basePath?: string;
  /** Modo demo: oculta cuenta corriente y canje del pago. */
  modoDemo?: boolean;
  /** Mutaciones inyectables (default: las server actions reales). */
  acciones?: AccionesVentas;
}) {
  const { publish } = useRealtime();
  const dolarVenta = useDolar().venta;
  const esAdmin = user.rol === "admin";
  // El vendedor no ve costo/margen de las ventas -- expone el precio de
  // compra (margen = 1 - costo/precio, con el precio visible ya alcanza).
  const puedeVerCosto = user.rol !== "vendedor";

  const searchParams = useSearchParams();
  const router = useRouter();
  const acc: AccionesVentas = acciones ?? {
    crearVenta: createVentaAction,
    eliminarVenta: deleteVentaAction,
    refrescar: () => router.refresh(),
  };
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openOverride, setOpenOverride] = useState<string | null | undefined>(
    undefined,
  );
  const [qInput, setQInput] = useState(filtros.q);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restituirEquipos, setRestituirEquipos] = useState(true);
  const [restituirRepuestos, setRestituirRepuestos] = useState(true);
  const [eliminarMovimientosCaja, setEliminarMovimientosCaja] = useState(true);
  const [eliminarMovimientoCC, setEliminarMovimientoCC] = useState(true);
  const [eliminarCompraCanje, setEliminarCompraCanje] = useState(true);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [recibo, setRecibo] = useState<
    | { venta: Venta; tipo: "venta" }
    | { venta: Venta; tipo: "garantia"; item?: VentaItem }
    | null
  >(null);

  const equiposPorId = useMemo(
    () => new Map(equipos.map((e) => [e.id, e])),
    [equipos],
  );
  const clientesPorId = useMemo(
    () => new Map(clientesOpciones.map((c) => [c.id, c])),
    [clientesOpciones],
  );

  function navegar(next: FiltrosVentas) {
    const qs = queryDeFiltros(next);
    startTransition(() => {
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    });
  }

  function actualizar(patch: Partial<FiltrosVentas>) {
    const next = { ...filtros, ...patch };
    if (!("page" in patch)) next.page = 1;
    navegar(next);
  }

  function limpiarTodo() {
    navegar({
      preset: "mes",
      desde: "",
      hasta: "",
      vendedor: "",
      tipo: "",
      q: "",
      vista: "ventas",
      page: 1,
      sort: "fecha",
      dir: "desc",
    });
  }

  function toggleSort(col: SortVentas) {
    if (filtros.sort === col) {
      actualizar({ dir: filtros.dir === "asc" ? "desc" : "asc" });
    } else {
      actualizar({ sort: col, dir: "desc" });
    }
  }

  // ?accion=nueva-venta: lo usa el CommandPalette. Efecto (no estado inicial)
  // para que también funcione ya parado en /ventas.
  useEffect(() => {
    if (searchParams.get("accion") !== "nueva-venta") return;
    setCreating(true);
    router.replace(basePath);
  }, [searchParams, router, basePath]);

  // q está en la URL (fuente de verdad); el input local la sincroniza. El
  // debounce de 300 ms evita una query al server por tecla.
  useEffect(() => {
    setQInput(filtros.q);
  }, [filtros.q]);
  useEffect(() => {
    if (qInput === filtros.q) return;
    const t = setTimeout(() => {
      navegar({ ...filtros, q: qInput.trim(), page: 1 });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput, filtros.q]);

  // Al cambiar el deep link, descarta la selección local.
  useEffect(() => {
    setOpenOverride(undefined);
  }, [openId]);

  const abierta = useMemo(() => {
    // `undefined` = no hay selección local (manda el `?open=` de la URL);
    // `null` = se cerró explícitamente (aunque la URL todavía lo traiga,
    // mientras el `router.replace` termina).
    const id = openOverride === undefined ? openId : openOverride;
    if (!id) return null;
    return ventas.find((v) => v.id === id) ?? (ventaAbierta?.id === id ? ventaAbierta : null);
  }, [openOverride, openId, ventas, ventaAbierta]);

  function abrirDetalle(id: string) {
    setOpenOverride(id);
  }

  function cerrarDetalle() {
    setOpenOverride(null);
    if (openId) {
      const qs = queryDeFiltros(filtros);
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    }
  }

  function eliminarVenta(venta: Venta) {
    const id = venta.id;
    startTransition(async () => {
      try {
        await acc.eliminarVenta(id, {
          restituirEquipos,
          restituirRepuestos,
          eliminarMovimientosCaja,
          eliminarMovimientoCC,
          eliminarCompraCanje,
        });
        cerrarDetalle();
        setConfirmDelete(false);
        publish({
          type: "item_deleted",
          actor: user.nombre,
          entity: "Venta",
          label: `${id} · ${venta.cliente}`,
        });
        acc.refrescar();
      } catch {
        setErrorEliminar("No se pudo eliminar la venta. Probá de nuevo.");
      }
    });
  }

  const delta = (actual: number, anterior: number | undefined) =>
    resumenAnterior && anterior ? ((actual - anterior) / anterior) * 100 : undefined;

  const margenDelta =
    resumenAnterior &&
    resumen.margenPct !== null &&
    resumenAnterior.margenPct !== null
      ? resumen.margenPct - resumenAnterior.margenPct
      : undefined;

  const filtrosActivos =
    (filtros.q ? 1 : 0) +
    (filtros.vendedor ? 1 : 0) +
    (filtros.tipo ? 1 : 0) +
    (filtros.preset !== "mes" ? 1 : 0);

  // Contenido del documento de Garantía -- reusado standalone y embebido.
  function garantiaContenido(itemsVenta: VentaItem[]) {
    return (
      <>
        <ReciboGarantiaItems
          items={itemsVenta.map((i) => ({
            detalle: i.detalle,
            serial: i.equipoId ? equiposPorId.get(i.equipoId)?.imei : undefined,
            garantia: i.equipoId ? negocio.garantiaTexto || "—" : "—",
          }))}
        />
        <ReciboNota titulo="Condiciones de garantía" texto={negocio.garantiaCondiciones} />
        <ReciboNotaLista
          titulo="Causales de anulación de la garantía"
          texto={negocio.garantiaCausales}
        />
        <ReciboNota titulo="Importante" texto={negocio.garantiaImportante} tono="warning" />
      </>
    );
  }

  const paginasVenta: ReciboPagina[] | undefined =
    recibo?.tipo === "venta"
      ? [
          {
            titulo: "Recibo",
            children: (
              <>
                <ReciboLineas
                  titulo="Detalle"
                  forzarTabla
                  lineas={recibo.venta.items.map((i) => ({
                    detalle: i.detalle,
                    cantidad: i.cantidad,
                    montoUsd: i.cantidad * i.precioUsd,
                    serial: i.equipoId ? equiposPorId.get(i.equipoId)?.imei : undefined,
                  }))}
                  total={recibo.venta.totalUsd}
                />
                <ReciboLineas
                  titulo="Forma de pago"
                  lineas={recibo.venta.pagos.map((p) => ({
                    detalle: medioPagoCfg[p.medio].label,
                    montoUsd: p.montoUsd,
                    montoLabel: montoPagoLabel(p),
                  }))}
                />
              </>
            ),
          },
          ...(recibo.venta.items.some((i) => i.equipoId)
            ? [
                {
                  titulo: "Garantía",
                  compacto: true,
                  sello: true,
                  children: garantiaContenido(recibo.venta.items),
                },
              ]
            : []),
        ]
      : undefined;

  const garantiaPagina: ReciboPagina[] | undefined =
    recibo?.tipo === "garantia"
      ? [
          {
            titulo: "Garantía",
            compacto: true,
            sello: true,
            children: garantiaContenido(recibo.item ? [recibo.item] : recibo.venta.items),
          },
        ]
      : undefined;

  return (
    <>
      <SeccionTabla
        id="ventas"
        graficos={
          <>
            <GraficoBarrasVerticales
              title="Facturación por día"
              sub={contexto}
              rows={graficos.porDia}
              fmt={fmtUsd}
              vacio="Sin ventas en el período."
            />
            <GraficoDona
              title="Mix por rubro"
              sub="Facturado del período"
              data={graficos.porRubro}
              fmtValor={fmtUsd}
              vacio="Sin ítems vendidos."
            />
          </>
        }
        tarjetas={
          <>
            <StatCard
              align="left"
              label="Operaciones"
              value={resumen.operaciones}
              delta={delta(resumen.operaciones, resumenAnterior?.operaciones)}
              deltaHint={deltaHint}
            />
            <StatCard
              align="left"
              label="Facturado"
              value={fmtUsd(resumen.facturado)}
              delta={delta(resumen.facturado, resumenAnterior?.facturado)}
              deltaHint={deltaHint}
            />
            {puedeVerCosto ? (
              <StatCard
                align="left"
                label="Margen promedio"
                value={resumen.margenPct !== null ? `${resumen.margenPct.toFixed(1)}%` : "—"}
                hint={resumen.margenPct === null ? "sin costos cargados" : undefined}
                delta={margenDelta}
                deltaHint={deltaHint}
              />
            ) : (
              <StatCard
                align="left"
                label="Ítems vendidos"
                value={resumen.itemsVendidos}
                delta={delta(resumen.itemsVendidos, resumenAnterior?.itemsVendidos)}
                deltaHint={deltaHint}
              />
            )}
            <StatCard
              align="left"
              label="Ticket promedio"
              value={fmtUsd(resumen.ticketPromedio)}
              delta={delta(resumen.ticketPromedio, resumenAnterior?.ticketPromedio)}
              deltaHint={deltaHint}
            />
          </>
        }
        filtros={
          <>

        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Buscar por cliente, serie o producto…"
              className={cn("w-full pl-9", filterPill)}
              aria-label="Buscar ventas"
            />
          </div>

          <Button
            onClick={() => setFiltersOpen((v) => !v)}
            variant="outline"
            fullOnMobile
            className="md:hidden"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros{filtrosActivos > 0 ? ` · ${filtrosActivos}` : ""}
            {filtersOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          <div
            className={cn(
              "flex-col gap-2 md:contents",
              filtersOpen ? "flex" : "hidden",
            )}
          >
            <Tabs
              value={filtros.vista}
              onChange={(v) => actualizar({ vista: v })}
              className="w-full justify-between md:w-auto md:justify-start"
              options={[
                { value: "ventas", label: "Ventas", count: totalVentas },
                { value: "items", label: "Ítems vendidos", count: totalItems },
              ]}
            />
            <Select
              value={filtros.preset}
              onChange={(e) => {
                const preset = e.target.value as DatePreset;
                actualizar({ preset, desde: "", hasta: "" });
              }}
              className={cn("w-full md:w-44", filterPill)}
              aria-label="Filtrar por período"
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
            {vendedores.length > 1 && (
              <Select
                value={filtros.vendedor}
                onChange={(e) => actualizar({ vendedor: e.target.value })}
                className={cn("w-full md:w-44", filterPill)}
                aria-label="Filtrar por vendedor"
              >
                <option value="">Todos los vendedores</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </Select>
            )}
            <Select
              value={filtros.tipo}
              onChange={(e) => actualizar({ tipo: e.target.value as FiltrosVentas["tipo"] })}
              className={cn("w-full md:w-40", filterPill)}
              aria-label="Filtrar por tipo"
            >
              <option value="">Todo</option>
              <option value="equipo">Equipos</option>
              <option value="servicio">Reparaciones</option>
              <option value="otro">Accesorios</option>
              <option value="libre">Otros</option>
            </Select>
            {filtros.preset === "personalizado" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={filtros.desde}
                  onChange={(e) => actualizar({ desde: e.target.value })}
                  className={cn("w-full md:w-36", filterPill)}
                  aria-label="Desde"
                />
                <span className="text-xs text-neutral-500">a</span>
                <Input
                  type="date"
                  value={filtros.hasta}
                  onChange={(e) => actualizar({ hasta: e.target.value })}
                  className={cn("w-full md:w-36", filterPill)}
                  aria-label="Hasta"
                />
              </div>
            )}
          </div>

          <Button icon={Plus}
            onClick={() => setCreating(true)}
            variant="tonal" fullOnMobile className="md:ml-auto"
          >
            Nueva venta
          </Button>
        </div>

        {hayFiltrosActivos(filtros) && (
          <div className="flex flex-wrap items-center gap-2">
            {filtros.vendedor && (
              <FiltroChip
                label={`Vendedor: ${vendedores.find((v) => v.id === filtros.vendedor)?.nombre ?? "—"}`}
                onClear={() => actualizar({ vendedor: "" })}
              />
            )}
            {filtros.tipo && (
              <FiltroChip
                label={`Tipo: ${RUBRO_LABEL[filtros.tipo]}`}
                onClear={() => actualizar({ tipo: "" })}
              />
            )}
            {filtros.q && (
              <FiltroChip
                label={`Búsqueda: «${filtros.q}»`}
                onClear={() => actualizar({ q: "" })}
              />
            )}
            {filtros.preset !== "mes" && (
              <FiltroChip
                label={`Período: ${DATE_PRESETS.find((p) => p.value === filtros.preset)?.label ?? ""}`}
                onClear={() => actualizar({ preset: "mes", desde: "", hasta: "" })}
              />
            )}
            <button
              type="button"
              onClick={limpiarTodo}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Limpiar todo
            </button>
          </div>
        )}
          </>
        }
      >

        <div className={cn("space-y-4", isPending && "opacity-60")}>
          {filtros.vista === "items" ? (
            <ItemsVendidosTabla
              items={items}
              puedeVerCosto={puedeVerCosto}
              onOpen={abrirDetalle}
              onGarantia={(v, i) => setRecibo({ venta: v, tipo: "garantia", item: i })}
              vacio={totalItems === 0}
              hayFiltros={hayFiltrosActivos(filtros)}
              onLimpiar={limpiarTodo}
              onNueva={() => setCreating(true)}
            />
          ) : (
            <VentasTabla
              ventas={ventas}
              puedeVerCosto={puedeVerCosto}
              filtros={filtros}
              onSort={toggleSort}
              onOpen={abrirDetalle}
              onRecibo={(v) => setRecibo({ venta: v, tipo: "venta" })}
              onGarantia={(v) => setRecibo({ venta: v, tipo: "garantia" })}
              vacio={totalVentas === 0}
              hayFiltros={hayFiltrosActivos(filtros)}
              onLimpiar={limpiarTodo}
              onNueva={() => setCreating(true)}
            />
          )}

          <Pagination
            page={filtros.page}
            total={filtros.vista === "items" ? totalItems : totalVentas}
            onPageChange={(page) => actualizar({ page })}
          />
        </div>
      </SeccionTabla>

      <NuevaVentaDialog
        key={creating ? "abierto" : "cerrado"}
        open={creating}
        onClose={() => setCreating(false)}
        clientesOpciones={clientesOpciones}
        equipos={equipos}
        otros={otros}
        servicios={servicios}
        repuestos={repuestos}
        vendedores={vendedores}
        cajas={cajas}
        negocio={negocio}
        dolarVenta={dolarVenta}
        user={user}
        crearVenta={acc.crearVenta}
        modoDemo={modoDemo}
        onCreate={(v) => {
          setCreating(false);
          publish({
            type: "sale_confirmed",
            actor: v.vendedor,
            amountUsd: v.totalUsd,
            ref: v.id,
            cliente: v.cliente,
          });
          acc.refrescar();
        }}
      />

      <Dialog
        open={!!abierta}
        onClose={cerrarDetalle}
        size="2xl"
        title={abierta ? `Venta ${abierta.id}` : ""}
        description={abierta ? abierta.fecha : ""}
        footer={
          abierta && (
            <>
              {esAdmin && (
                <Button icon={Trash2}
                  onClick={() => {
                    setRestituirEquipos(true);
                    setRestituirRepuestos(true);
                    setEliminarMovimientosCaja(true);
                    setEliminarMovimientoCC(true);
                    setEliminarCompraCanje(true);
                    setErrorEliminar(null);
                    setConfirmDelete(true);
                  }}
                  variant="danger-outline" fullOnMobile className="sm:mr-auto"
                >
                  Eliminar venta
                </Button>
              )}
              <Button
                onClick={cerrarDetalle}
                variant="outline" fullOnMobile
              >
                Cerrar
              </Button>
              <ImprimirMenu
                onComprobante={() => setRecibo({ venta: abierta, tipo: "venta" })}
                onGarantia={() => setRecibo({ venta: abierta, tipo: "garantia" })}
              />
            </>
          )
        }
      >
        {abierta && (
          <VentaDetalle venta={abierta} puedeVerCosto={puedeVerCosto} cajas={cajas} />
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setErrorEliminar(null);
        }}
        onConfirm={() => abierta && eliminarVenta(abierta)}
        title="¿Eliminar venta?"
        confirmLabel="Eliminar venta"
        pending={isPending}
      >
        {abierta && (
          <>
            <p>
              Se eliminará la venta {abierta.id} de {abierta.cliente}. Esta acción
              no se puede deshacer.
            </p>
            {abierta.items.some((i) => i.equipoId) && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={restituirEquipos}
                  onChange={(e) => setRestituirEquipos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Devolver los equipos vendidos al inventario (quedan
                «disponibles» de nuevo)
              </label>
            )}
            {abierta.items.some((i) => i.repuestos?.length) && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={restituirRepuestos}
                  onChange={(e) => setRestituirRepuestos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Devolver los repuestos usados al stock
              </label>
            )}
            {abierta.tieneMovimientoCaja && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={eliminarMovimientosCaja}
                  onChange={(e) => setEliminarMovimientosCaja(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Eliminar también los movimientos de caja generados por esta
                venta
              </label>
            )}
            {abierta.tieneMovimientoCC && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={eliminarMovimientoCC}
                  onChange={(e) => setEliminarMovimientoCC(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Eliminar también el movimiento de cuenta corriente generado
                por esta venta
              </label>
            )}
            {abierta.pagos.some((p) => p.medio === "canje" && p.compraId) && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={eliminarCompraCanje}
                  onChange={(e) => setEliminarCompraCanje(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Eliminar también la compra de canje generada por esta venta
              </label>
            )}
            {errorEliminar && <p className="text-sm text-red-600">{errorEliminar}</p>}
          </>
        )}
      </ConfirmDialog>

      <ReciboImprimir
        key={
          recibo
            ? `${recibo.tipo}-${recibo.venta.id}-${
                recibo.tipo === "garantia" ? (recibo.item?.equipoId ?? "full") : ""
              }`
            : "recibo-none"
        }
        open={!!recibo}
        onClose={() => setRecibo(null)}
        titulo={recibo?.tipo === "garantia" ? "Garantía" : "Recibo"}
        nro={recibo?.venta.id ?? ""}
        fecha={recibo ? fmtDateSlash(recibo.venta.fechaISO) : ""}
        cliente={recibo?.venta.cliente ?? ""}
        clienteTelefono={recibo ? clientesPorId.get(recibo.venta.clienteId)?.telefono : undefined}
        clienteEmail={recibo ? clientesPorId.get(recibo.venta.clienteId)?.email : undefined}
        negocio={negocio}
        paginas={recibo?.tipo === "garantia" ? garantiaPagina : paginasVenta}
      />
    </>
  );
}

// ─────────────────────────── Chips / headers ───────────────────────────

function FiltroChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Quitar filtro ${label}`}
        className="grid h-3.5 w-3.5 place-items-center rounded-full text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
      >
        ×
      </button>
    </span>
  );
}

function ThSort({
  label,
  col,
  filtros,
  onSort,
  className,
}: {
  label: string;
  col: SortVentas;
  filtros: FiltrosVentas;
  onSort: (col: SortVentas) => void;
  className?: string;
}) {
  const activo = filtros.sort === col;
  return (
    <th
      className={cn("px-5 py-3", thDivider, className)}
      aria-sort={
        activo ? (filtros.dir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className="inline-flex items-center gap-1 transition-colors hover:text-white/80"
      >
        {label}
        {activo &&
          (filtros.dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          ))}
      </button>
    </th>
  );
}

// ─────────────────────────── Tabla de ventas ───────────────────────────

function VentasTabla({
  ventas,
  puedeVerCosto,
  filtros,
  onSort,
  onOpen,
  onRecibo,
  onGarantia,
  vacio,
  hayFiltros,
  onLimpiar,
  onNueva,
}: {
  ventas: Venta[];
  puedeVerCosto: boolean;
  filtros: FiltrosVentas;
  onSort: (col: SortVentas) => void;
  onOpen: (id: string) => void;
  onRecibo: (v: Venta) => void;
  onGarantia: (v: Venta) => void;
  vacio: boolean;
  hayFiltros: boolean;
  onLimpiar: () => void;
  onNueva: () => void;
}) {
  const colSpan = puedeVerCosto ? 7 : 6;
  return (
    <>
      <div className="space-y-2 md:hidden">
        {ventas.map((v) => (
          <VentaCardMobile
            key={v.id}
            venta={v}
            onOpen={() => onOpen(v.id)}
            onRecibo={() => onRecibo(v)}
            onGarantia={() => onGarantia(v)}
            puedeVerCosto={puedeVerCosto}
          />
        ))}
        {vacio && (
          <EmptyState
            hayFiltros={hayFiltros}
            onLimpiar={onLimpiar}
            onNueva={onNueva}
          />
        )}
      </div>
      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-500">
              <ThSort label="Venta" col="numero" filtros={filtros} onSort={onSort} />
              <th className={cn("px-5 py-3", thDivider)}>Cliente</th>
              <th className={cn("px-5 py-3", thDivider)}>Detalle</th>
              <th className={cn("px-5 py-3", thDivider)}>Pago</th>
              {puedeVerCosto && (
                <ThSort
                  label="Margen"
                  col="margen_pct"
                  filtros={filtros}
                  onSort={onSort}
                  className="text-right"
                />
              )}
              <ThSort
                label="Total"
                col="total_usd"
                filtros={filtros}
                onSort={onSort}
                className="text-right"
              />
              <th className="w-px whitespace-nowrap px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr
                key={v.id}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(v.id);
                }}
                onClick={() => onOpen(v.id)}
                className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
              >
                <td className="px-5 py-2 font-medium text-neutral-700">
                  {v.id}
                  <span className="block text-xs font-normal text-neutral-500">
                    {v.fecha}
                  </span>
                </td>
                <td className="max-w-[160px] truncate px-5 py-2">{v.cliente}</td>
                <td className="max-w-[260px] truncate px-5 py-2 text-neutral-600">
                  {v.items.map((i) => i.detalle).join(" · ")}
                </td>
                <td className="px-5 py-2">
                  <PagoChip pagos={v.pagos} />
                </td>
                {puedeVerCosto && (
                  <td className="px-5 py-2 text-right tabular-nums text-neutral-500">
                    {ventaMargenLabel(v)}
                  </td>
                )}
                <td className="px-5 py-2 text-right font-semibold tabular-nums">
                  {fmtUsd(v.totalUsd)}
                </td>
                <td className="w-px whitespace-nowrap px-5 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRecibo(v);
                      }}
                      title="Imprimir recibo"
                      aria-label={`Imprimir recibo de ${v.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-accent-soft hover:text-accent"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onGarantia(v);
                      }}
                      title="Imprimir garantía"
                      aria-label={`Imprimir garantía de ${v.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-accent-soft hover:text-accent"
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {vacio && (
              <tr>
                <td colSpan={colSpan} className="px-5 py-10">
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-neutral-500">
                      {hayFiltros
                        ? "Sin ventas para estos filtros."
                        : "Todavía no hay ventas."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={hayFiltros ? onLimpiar : onNueva}
                    >
                      {hayFiltros ? "Limpiar filtros" : "Nueva venta"}
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function EmptyState({
  hayFiltros,
  onLimpiar,
  onNueva,
}: {
  hayFiltros: boolean;
  onLimpiar: () => void;
  onNueva: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-200 px-4 py-10">
      <p className="text-sm text-neutral-500">
        {hayFiltros ? "Sin ventas para estos filtros." : "Todavía no hay ventas."}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={hayFiltros ? onLimpiar : onNueva}
      >
        {hayFiltros ? "Limpiar filtros" : "Nueva venta"}
      </Button>
    </div>
  );
}

// ─────────────────────── Tabla de ítems vendidos ───────────────────────

function ItemsVendidosTabla({
  items,
  puedeVerCosto,
  onOpen,
  onGarantia,
  vacio,
  hayFiltros,
  onLimpiar,
  onNueva,
}: {
  items: ItemVendido[];
  puedeVerCosto: boolean;
  onOpen: (id: string) => void;
  onGarantia: (v: Venta, i: VentaItem) => void;
  vacio: boolean;
  hayFiltros: boolean;
  onLimpiar: () => void;
  onNueva: () => void;
}) {
  const colSpan = puedeVerCosto ? 7 : 6;
  return (
    <>
      <div className="space-y-2 md:hidden">
        {items.map(({ venta: v, item: i, serial }, idx) => (
          <Card
            key={`${v.id}-${idx}`}
            onClick={() => onOpen(v.id)}
            className="cursor-pointer p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-neutral-500">
                {v.id} · {v.fecha} · {v.cliente}
              </p>
              <IconButton aria-label="Imprimir garantía" icon={ShieldCheck} variant="ghost" size="sm" onClick={(e) => {
                  e.stopPropagation();
                  onGarantia(v, i);
                }} title="Imprimir garantía" />
            </div>
            <div className="mt-1 flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium text-neutral-900">
                {i.detalle}
              </p>
              <span className="shrink-0 text-xs text-neutral-500">
                {RUBRO_LABEL[categoriaDe(i)]}
              </span>
            </div>
            {serial && (
              <p className="mt-0.5 font-mono text-xs text-neutral-500">{serial}</p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-neutral-500">
                {puedeVerCosto && `Margen ${itemMargenLabel(i)}`}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {fmtUsd(i.precioUsd)}
              </span>
            </div>
          </Card>
        ))}
        {vacio && (
          <EmptyState hayFiltros={hayFiltros} onLimpiar={onLimpiar} onNueva={onNueva} />
        )}
      </div>
      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-500">
              <th className={cn("px-5 py-3", thDivider)}>Venta</th>
              <th className={cn("px-5 py-3", thDivider)}>Cliente</th>
              <th className={cn("px-5 py-3", thDivider)}>Ítem</th>
              <th className={cn("px-5 py-3", thDivider)}>Serie</th>
              <th className={cn("px-5 py-3 text-right", thDivider)}>Precio</th>
              {puedeVerCosto && (
                <th className={cn("px-5 py-3 text-right", thDivider)}>Margen</th>
              )}
              <th className="w-px whitespace-nowrap px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ venta: v, item: i, serial }, idx) => (
              <tr
                key={`${v.id}-${idx}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(v.id);
                }}
                onClick={() => onOpen(v.id)}
                className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
              >
                <td className="px-5 py-2 font-medium text-neutral-700">
                  {v.id}
                  <span className="block text-xs font-normal text-neutral-500">
                    {v.fecha}
                  </span>
                </td>
                <td className="max-w-[160px] truncate px-5 py-2">{v.cliente}</td>
                <td className="max-w-[260px] truncate px-5 py-2">{i.detalle}</td>
                <td className="px-5 py-2 font-mono text-xs tabular-nums text-neutral-500">
                  {serial ?? "—"}
                </td>
                <td className="px-5 py-2 text-right tabular-nums">
                  {fmtUsd(i.precioUsd)}
                </td>
                {puedeVerCosto && (
                  <td className="px-5 py-2 text-right tabular-nums text-neutral-500">
                    {itemMargenLabel(i)}
                  </td>
                )}
                <td className="w-px whitespace-nowrap px-5 py-2 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGarantia(v, i);
                    }}
                    title="Imprimir garantía"
                    aria-label={`Imprimir garantía de ${v.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-accent-soft hover:text-accent"
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {vacio && (
              <tr>
                <td colSpan={colSpan} className="px-5 py-10">
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-neutral-500">
                      {hayFiltros
                        ? "Sin ítems para estos filtros."
                        : "Todavía no hay ítems vendidos."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={hayFiltros ? onLimpiar : onNueva}
                    >
                      {hayFiltros ? "Limpiar filtros" : "Nueva venta"}
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ────────────────────── Tarjeta de venta (mobile) ──────────────────────

function VentaCardMobile({
  venta: v,
  onOpen,
  onRecibo,
  onGarantia,
  puedeVerCosto,
}: {
  venta: Venta;
  onOpen: () => void;
  onRecibo: () => void;
  onGarantia: () => void;
  puedeVerCosto: boolean;
}) {
  return (
    <Card onClick={onOpen} className="cursor-pointer overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 bg-table-header px-4 py-2 text-white">
        <span className="text-sm font-semibold">{v.id}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70">{v.fecha}</span>
          <IconButton aria-label="Imprimir recibo" icon={FileText} variant="ghost" size="sm" onClick={(e) => {
              e.stopPropagation();
              onRecibo();
            }} title="Imprimir recibo" />
          <IconButton aria-label="Imprimir garantía" icon={ShieldCheck} variant="ghost" size="sm" onClick={(e) => {
              e.stopPropagation();
              onGarantia();
            }} title="Imprimir garantía" />
        </div>
      </div>

      <div className="flex items-stretch gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900">{v.cliente}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {v.items.map((i) => i.detalle).join(" · ")}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
            <PagoChip pagos={v.pagos} />
            {puedeVerCosto && (
              <span className="text-[11px] text-neutral-500">
                Margen {ventaMargenLabel(v)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center border-l border-neutral-100 pl-3">
          <p className="text-base font-semibold tabular-nums">{fmtUsd(v.totalUsd)}</p>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────── Imprimir (menú) ───────────────────────────

function ImprimirMenu({
  onComprobante,
  onGarantia,
}: {
  onComprobante: () => void;
  onGarantia: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useOutsideClick<HTMLDivElement>(() => setOpen(false));
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const btns = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
        );
        if (btns.length === 0) return;
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === "ArrowDown"
            ? (i + 1) % btns.length
            : (i - 1 + btns.length) % btns.length;
        btns[next]?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <Button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        variant="tonal" fullOnMobile
      >
        <FileText className="h-4 w-4" /> Imprimir
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="animate-fade-in absolute bottom-full right-0 z-10 mb-1 w-56 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
        >
          <button
            role="menuitem"
            onClick={() => {
              onComprobante();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 focus:bg-neutral-100 focus:outline-none"
          >
            <FileText className="h-4 w-4 text-neutral-500" /> Comprobante de venta
          </button>
          <button
            role="menuitem"
            onClick={() => {
              onGarantia();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 focus:bg-neutral-100 focus:outline-none"
          >
            <ShieldCheck className="h-4 w-4 text-neutral-500" /> Garantía
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────── Detalle de venta ──────────────────────

function cajaLabel(p: Pago, cajas: Caja[]): string {
  if (p.medio === "cuenta_corriente") return "Cuenta corriente";
  const caja = p.cajaId ? cajas.find((c) => c.id === p.cajaId) : undefined;
  if (caja) return caja.nombre;
  return p.caja === "ars" ? "Caja en pesos" : "Caja en dólares";
}

function VentaDetalle({
  venta,
  puedeVerCosto,
  cajas,
}: {
  venta: Venta;
  puedeVerCosto: boolean;
  cajas: Caja[];
}) {
  const metaFields: { label: string; value: string }[] = [
    { label: "Cliente", value: venta.cliente },
    { label: "Vendedor", value: venta.vendedor },
    ...(venta.procedencia
      ? [{ label: "Procedencia", value: venta.procedencia }]
      : []),
    { label: "Modalidad", value: MODALIDAD_LABEL[venta.modalidad] },
    {
      label: "Tipo",
      value:
        venta.tipo === "venta" ? "Venta de equipos" : "Reparación / servicio",
    },
  ];
  const m = margenVenta(venta.items);
  const totalCobrado = venta.pagos.reduce((a, p) => a + p.montoUsd, 0);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Información general
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metaFields.map((f, idx) => (
            <Card
              key={f.label}
              className={cn(
                "p-2 text-center",
                idx === metaFields.length - 1 &&
                  metaFields.length % 2 === 1 &&
                  "col-span-2 sm:col-span-1",
              )}
            >
              <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                {f.label}
              </p>
              <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">
                {f.value}
              </p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Ítems
        </p>
        <Card className="divide-y divide-neutral-100 overflow-hidden md:hidden">
          {venta.items.map((i, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-neutral-900">
                {i.detalle}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                ×{i.cantidad}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {fmtUsd(i.cantidad * i.precioUsd)}
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
            <span className="text-sm font-semibold tabular-nums">
              {fmtUsd(venta.totalUsd)}
            </span>
          </div>
        </Card>
        <div className="hidden overflow-hidden rounded-xl border border-neutral-200 md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-500">
                <th className={cn("px-4 py-2", thDivider)}>Detalle</th>
                <th className={cn("px-4 py-2 text-right", thDivider)}>Cant</th>
                {puedeVerCosto && (
                  <th className={cn("px-4 py-2 text-right", thDivider)}>Costo</th>
                )}
                <th className={cn("px-4 py-2 text-right", thDivider)}>Precio</th>
                <th className="px-4 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {venta.items.map((i, idx) => (
                <tr key={idx} className="border-t border-neutral-100 first:border-t-0">
                  <td className="px-4 py-2.5">{i.detalle}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{i.cantidad}</td>
                  {puedeVerCosto && (
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">
                      {i.costoUsd !== undefined ? fmtUsd(i.costoUsd) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtUsd(i.precioUsd)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {fmtUsd(i.cantidad * i.precioUsd)}
                  </td>
                </tr>
              ))}
              <tr
                className="border-t border-neutral-100 font-semibold text-neutral-900"
                style={{ backgroundColor: "var(--accent-soft)", backgroundImage: "none" }}
              >
                <td
                  className="px-4 py-2.5 uppercase tracking-wide"
                  colSpan={puedeVerCosto ? 4 : 3}
                >
                  Total
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {fmtUsd(venta.totalUsd)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Pagos
        </p>
        <Card className="divide-y divide-neutral-100 px-4 py-1">
          {venta.pagos.map((p, i) => (
            <div key={i} className="py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        dotClass[medioPagoCfg[p.medio].tone],
                      )}
                    />
                    {medioPagoCfg[p.medio].label}
                  </span>
                  <span className="text-xs text-neutral-500">{cajaLabel(p, cajas)}</span>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {montoPagoLabel(p)}
                </span>
              </div>
              {p.recargoPct ? (
                <p className="mt-1 text-xs text-neutral-500">
                  +{p.recargoPct}% recargo
                  {p.cotizacion ? ` · cotización ${fmtArs(p.cotizacion)}` : ""}
                </p>
              ) : null}
              {p.medio === "canje" && p.compraId ? (
                <a
                  href={`/compras?open=${p.compraId}`}
                  className="mt-1 inline-block text-xs font-semibold text-accent hover:underline"
                >
                  Ver compra de canje
                </a>
              ) : null}
            </div>
          ))}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-semibold uppercase tracking-wide text-neutral-900">
              Total cobrado
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {fmtUsd(totalCobrado)}
            </span>
          </div>
        </Card>
        {venta.pagos.some((p) => p.caja === "ars" && p.montoArs === undefined) && (
          <p className="mt-2 text-xs text-neutral-500">
            Monto en pesos no registrado (venta anterior a oct. 2026): se muestra en USD.
          </p>
        )}
      </div>

      {puedeVerCosto && (
        <div>
          <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Rentabilidad
          </p>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              align="left"
              label="Costo"
              value={m.margenPct === null ? "—" : fmtUsd(m.costoUsd)}
            />
            <StatCard
              align="left"
              label="Ganancia bruta"
              value={m.margenPct === null ? "—" : fmtUsd(m.gananciaUsd)}
            />
            <StatCard
              align="left"
              label="Margen"
              value={m.margenPct === null ? "—" : `${m.margenPct.toFixed(1)}%`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Nueva venta ───────────────────────────

const rid = () => Math.random().toString(36).slice(2);

type Origen = "equipo" | "otro" | "servicio" | "libre";
type DraftItem = VentaItem & { _k: string; origen: Origen };
type DraftPago = Pago & { _k: string; canje?: CanjeEquipo };

type CatItem = {
  key: string;
  origen: Exclude<Origen, "libre">;
  refId: string;
  nombre: string;
  costoUsd: number;
  precioUsd: number;
  serial?: string;
};

const origenTone: Record<Origen, "violet" | "blue" | "green" | "gray"> = {
  equipo: "violet",
  otro: "blue",
  servicio: "green",
  libre: "gray",
};
const origenLabel: Record<Origen, string> = {
  equipo: "Equipo",
  otro: "Producto",
  servicio: "Servicio",
  libre: "Libre",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
      {children}
    </p>
  );
}

// ── Buscador de ítems ──────────────────────────────────────────

function ItemBuscador({
  equipos,
  otros,
  servicios,
  yaAgregados,
  onAdd,
  onLibre,
}: {
  equipos: Equipo[];
  otros: OtroItem[];
  servicios: Servicio[];
  yaAgregados: string[];
  onAdd: (c: CatItem) => void;
  onLibre: (nombre: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useOutsideClick<HTMLDivElement>(() => setOpen(false));
  const inputRef = useRef<HTMLInputElement>(null);

  const catalogo: CatItem[] = useMemo(
    () => [
      ...equipos
        .filter((e) => e.estado === "disponible")
        .map((e) => ({
          key: `e-${e.id}`,
          origen: "equipo" as const,
          refId: e.id,
          nombre: `${e.modelo} ${e.almacenamiento} ${e.color}`,
          costoUsd: e.costoUsd,
          precioUsd: e.precioUsd,
          serial: e.imei,
        })),
      ...otros.map((o) => ({
        key: `o-${o.id}`,
        origen: "otro" as const,
        refId: o.id,
        nombre: o.nombre,
        costoUsd: otroCostoPromedio(o),
        precioUsd: o.precioUsd,
      })),
      ...servicios
        .filter((s) => s.activo)
        .map((s) => ({
          key: `s-${s.id}`,
          origen: "servicio" as const,
          refId: s.id,
          nombre: s.nombre,
          costoUsd: 0,
          precioUsd: s.precioUsd,
        })),
    ],
    [equipos, otros, servicios],
  );

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalogo
      .filter((c) => {
        const coincide =
          c.nombre.toLowerCase().includes(needle) ||
          (c.serial?.toLowerCase().includes(needle) ?? false);
        return coincide && !(c.origen === "equipo" && yaAgregados.includes(c.refId));
      })
      .slice(0, 8);
  }, [catalogo, q, yaAgregados]);

  const libre = q.trim();
  const total = matches.length + (libre ? 1 : 0);

  function elegir(idx: number) {
    if (idx < matches.length) onAdd(matches[idx]);
    else if (libre) onLibre(libre);
    else return;
    setQ("");
    setOpen(false);
    setActive(0);
    inputRef.current?.focus();
  }

  return (
    <div ref={wrapRef} className="relative">
      <Input
        ref={inputRef}
        placeholder="Buscar por nombre, color o IMEI/serial…"
        value={q}
        role="combobox"
        aria-expanded={open}
        aria-controls="item-buscador-lista"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (total ? (a + 1) % total : 0));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (total ? (a - 1 + total) % total : 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && total > 0) elegir(active);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <div
          id="item-buscador-lista"
          role="listbox"
          className="animate-menu-in absolute z-20 mt-1 max-h-64 w-full origin-top overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          {matches.map((c, idx) => (
            <button
              key={c.key}
              type="button"
              role="option"
              aria-selected={idx === active}
              onMouseEnter={() => setActive(idx)}
              onClick={() => elegir(idx)}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px]",
                idx === active ? "bg-accent-soft" : "hover:bg-neutral-50",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Badge tone={origenTone[c.origen]}>{origenLabel[c.origen]}</Badge>
                <span className="truncate">{c.nombre}</span>
                {c.serial && c.serial !== "—" && (
                  <span className="shrink-0 text-[11px] text-neutral-500">
                    {c.serial}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold text-neutral-500">
                {fmtUsd(c.precioUsd)}
              </span>
            </button>
          ))}
          {matches.length === 0 && !libre && (
            <p className="px-3 py-2 text-[13px] text-neutral-500">
              Sin coincidencias en el catálogo.
            </p>
          )}
          {libre && (
            <button
              type="button"
              role="option"
              aria-selected={active === matches.length}
              onMouseEnter={() => setActive(matches.length)}
              onClick={() => elegir(matches.length)}
              className={cn(
                "flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2 text-left text-[13px] font-medium text-accent",
                active === matches.length ? "bg-accent-soft" : "hover:bg-accent-soft",
              )}
            >
              <Plus className="h-3.5 w-3.5" /> Ítem libre: «{libre}»
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dialog ─────────────────────────────────────────────────────

function NuevaVentaDialog({
  open,
  onClose,
  onCreate,
  clientesOpciones,
  equipos,
  otros,
  servicios,
  repuestos,
  vendedores,
  cajas,
  negocio,
  dolarVenta,
  user,
  crearVenta,
  modoDemo = false,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (v: Venta) => void;
  clientesOpciones: ClienteOpcion[];
  equipos: Equipo[];
  otros: OtroItem[];
  servicios: Servicio[];
  repuestos: Repuesto[];
  vendedores: PersonaOpcion[];
  cajas: Caja[];
  negocio: Negocio;
  dolarVenta: number;
  user: SessionUser;
  crearVenta: (input: CrearVentaInput) => Promise<Venta>;
  modoDemo?: boolean;
}) {
  const [cliente, setCliente] = useState<ClienteSeleccion | null>(null);
  const esAdmin = user.rol === "admin";

  const [vendedorId, setVendedorId] = useState(user.id);
  const [procedencia, setProcedencia] = useState(PROCEDENCIAS[0]);
  const [modalidad, setModalidad] = useState<ModalidadVenta>("minorista");

  const cajasActivas = cajas.filter(
    (c) => c.activa && (!modoDemo || c.medioPago !== "canje"),
  );
  const destinoPago = (destino: string): Partial<DraftPago> => {
    if (destino === "cuenta_corriente") {
      return {
        medio: "cuenta_corriente",
        cajaId: undefined,
        caja: "usd",
        recargoPct: negocio.recargosMediosPago.cuenta_corriente,
      };
    }
    const caja = cajasActivas.find((c) => c.id === destino);
    return {
      medio: caja?.medioPago ?? "transferencia",
      cajaId: caja?.id,
      caja: caja?.moneda ?? "usd",
      recargoPct: caja ? negocio.recargosMediosPago[caja.medioPago] : undefined,
    };
  };
  const destinoDe = (p: DraftPago) => p.cajaId ?? p.medio;

  const cajasDeMedio = (medio: MedioPago) =>
    cajasActivas.filter((c) => c.medioPago === medio);
  const mediosDisponibles = MEDIOS_CAJA.filter(
    (m) => (!modoDemo || m !== "canje") && cajasDeMedio(m).length > 0,
  );
  const medioAPago = (medio: MedioPagoVenta): Partial<DraftPago> => {
    if (medio === "cuenta_corriente") {
      return {
        medio,
        cajaId: undefined,
        caja: "usd",
        recargoPct: negocio.recargosMediosPago.cuenta_corriente,
      };
    }
    const caja = cajasDeMedio(medio)[0];
    return {
      medio,
      cajaId: caja?.id,
      caja: caja?.moneda ?? "usd",
      recargoPct: negocio.recargosMediosPago[medio],
    };
  };

  const [items, setItems] = useState<DraftItem[]>([]);
  const [pagos, setPagos] = useState<DraftPago[]>([
    {
      _k: rid(),
      ...destinoPago(cajasActivas[0]?.id ?? "cuenta_corriente"),
      montoUsd: 0,
    } as DraftPago,
  ]);
  const [canjeModalKey, setCanjeModalKey] = useState<string | null>(null);
  const [confirmMonto, setConfirmMonto] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totalPrecio = items.reduce((a, i) => a + i.cantidad * i.precioUsd, 0);
  const margenPct = margenVenta(items).margenPct ?? 0;
  const restante = calcularRestante(totalPrecio, pagos);
  const clienteNombre = cliente?.nombre ?? "";

  const motivo = motivoNoConfirmable({
    clienteNombre,
    items: items.map((i) => ({ detalle: i.detalle, precioUsd: i.precioUsd })),
    pagos: pagos.map((p) => ({
      montoUsd: p.montoUsd,
      medio: p.medio,
      canjeEquipo: p.canje?.equipo,
    })),
    totalPrecio,
  });
  const valid = motivo === null;

  function addCatalogo(c: CatItem) {
    setItems((p) => [
      ...p,
      {
        _k: rid(),
        origen: c.origen,
        equipoId: c.origen === "equipo" ? c.refId : undefined,
        detalle: c.nombre,
        cantidad: 1,
        costoUsd: c.costoUsd,
        precioUsd: c.precioUsd,
      },
    ]);
  }
  function addLibre(nombre: string) {
    setItems((p) => [
      ...p,
      {
        _k: rid(),
        origen: "libre",
        detalle: nombre,
        cantidad: 1,
        costoUsd: 0,
        precioUsd: 0,
      },
    ]);
  }
  const updItem = (k: string, patch: Partial<DraftItem>) =>
    setItems((p) => p.map((i) => (i._k === k ? { ...i, ...patch } : i)));
  const rmItem = (k: string) => setItems((p) => p.filter((i) => i._k !== k));

  const addRepuestoUsado = (itemKey: string, repuestoId: string) => {
    const r = repuestos.find((x) => x.id === repuestoId);
    if (!r) return;
    setItems((p) =>
      p.map((i) =>
        i._k === itemKey
          ? {
              ...i,
              repuestos: [
                ...(i.repuestos ?? []),
                { repuestoId: r.id, nombre: r.nombre, cantidad: 1 },
              ],
            }
          : i,
      ),
    );
  };
  const updRepuestoUsado = (itemKey: string, idx: number, cantidad: number) =>
    setItems((p) =>
      p.map((i) =>
        i._k === itemKey
          ? {
              ...i,
              repuestos: (i.repuestos ?? []).map((r, j) =>
                j === idx ? { ...r, cantidad } : r,
              ),
            }
          : i,
      ),
    );
  const rmRepuestoUsado = (itemKey: string, idx: number) =>
    setItems((p) =>
      p.map((i) =>
        i._k === itemKey
          ? { ...i, repuestos: (i.repuestos ?? []).filter((_, j) => j !== idx) }
          : i,
      ),
    );

  const destinos = modoDemo
    ? cajasActivas.map((c) => c.id)
    : ["cuenta_corriente", ...cajasActivas.map((c) => c.id)];
  const updPago = (k: string, patch: Partial<DraftPago>) =>
    setPagos((p) => p.map((x) => (x._k === k ? { ...x, ...patch } : x)));
  const rmPago = (k: string) =>
    setPagos((p) => (p.length > 1 ? p.filter((x) => x._k !== k) : p));
  const addPago = () =>
    setPagos((p) => {
      const usados = p.map(destinoDe);
      const destino = destinos.find((d) => !usados.includes(d)) ?? destinos[0];
      return [
        ...p,
        {
          _k: rid(),
          ...destinoPago(destino),
          montoUsd: restante > 0 ? restante : 0,
        } as DraftPago,
      ];
    });
  const saldar = () => setPagos((p) => saldarUltimoPago(p, restante));

  function submit() {
    if (!cliente || cliente.tipo === "libre") return;
    startTransition(async () => {
      const vendedorNombre = esAdmin
        ? (vendedores.find((v) => v.id === vendedorId)?.nombre ?? "")
        : user.nombre;
      try {
        const venta = await crearVenta({
          cliente,
          vendedorId: esAdmin ? vendedorId : user.id,
          vendedorNombre,
          procedencia,
          modalidad,
          items: items.map(({ _k, origen, ...i }) => ({ ...i, categoria: origen })),
          totalUsd: totalPrecio,
          pagos: pagos.map(({ _k, ...p }) => p),
          margenPct: Math.round(margenPct * 10) / 10,
          tipo: items.some((i) => i.origen === "equipo") ? "venta" : "reparacion",
          dolarVenta,
        });
        onCreate({ ...venta, vendedor: vendedorNombre || venta.vendedor });
      } catch {
        setErrorCrear("No se pudo crear la venta. Probá de nuevo.");
      }
    });
  }

  function confirmarClick() {
    if (Math.abs(restante) < 0.005) {
      submit();
    } else {
      setConfirmMonto(true);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="4xl"
      title="Nueva venta"
      description="El número de venta se asigna al confirmar"
      footer={
        <>
          {!valid && (
            <p aria-live="polite" className="mr-auto text-sm text-neutral-500">
              {motivo}
            </p>
          )}
          <Button
            onClick={onClose}
            variant="outline" fullOnMobile
          >
            Cancelar
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={confirmarClick}
            variant="primary" fullOnMobile
          >
            {pending ? "Confirmando…" : `Confirmar venta · ${fmtUsd(totalPrecio)}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-5 lg:space-y-0">
        <div className="space-y-5">
        <Card className="p-4">
          <Eyebrow>Cliente</Eyebrow>
          <ClientePicker clientes={clientesOpciones} value={cliente} onChange={setCliente} />
        </Card>

        <Card className="p-4">
          <Eyebrow>Datos de la venta</Eyebrow>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Vendedor">
              {esAdmin ? (
                <Select
                  value={vendedorId}
                  onChange={(e) => setVendedorId(e.target.value)}
                >
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="flex h-9 w-full items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-600">
                  {user.nombre}
                </div>
              )}
            </Field>
            <Field label="Procedencia">
              <Select
                value={procedencia}
                onChange={(e) => setProcedencia(e.target.value)}
              >
                {PROCEDENCIAS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field label="Modalidad">
              <Select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as ModalidadVenta)}
              >
                {(Object.keys(MODALIDAD_LABEL) as ModalidadVenta[]).map((m) => (
                  <option key={m} value={m}>
                    {MODALIDAD_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="p-4">
          <Eyebrow>Ítems</Eyebrow>

          <ItemBuscador
            equipos={equipos}
            otros={otros}
            servicios={servicios}
            yaAgregados={items
              .map((i) => i.equipoId)
              .filter((x): x is string => !!x)}
            onAdd={addCatalogo}
            onLibre={addLibre}
          />

          {items.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-[13px] text-neutral-500">
              Buscá arriba cualquier equipo, producto o servicio por su nombre.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="hidden items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 sm:flex">
                <span className="flex-1 text-start">Ítem</span>
                <span className="w-12 text-right">Cant</span>
                <span className="w-24 text-right">Precio</span>
                <span className="w-9" />
              </div>
              {items.map((it) => (
                <div key={it._k}>
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                    <Input
                      className="min-w-0 sm:flex-1"
                      placeholder="Nombre del ítem"
                      value={it.detalle}
                      readOnly={it.origen !== "libre"}
                      onChange={(e) =>
                        updItem(it._k, { detalle: e.target.value })
                      }
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        className="w-16 text-right tabular-nums sm:w-12"
                        type="number"
                        min={1}
                        value={it.cantidad}
                        onChange={(e) =>
                          updItem(it._k, { cantidad: Number(e.target.value) || 1 })
                        }
                      />
                      <Input
                        className="flex-1 text-right tabular-nums sm:w-24 sm:flex-none"
                        type="number"
                        min={0}
                        placeholder="U$"
                        value={it.precioUsd || ""}
                        onChange={(e) =>
                          updItem(it._k, {
                            precioUsd: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <IconButton aria-label="Quitar" icon={Trash2} variant="danger-ghost" size="lg" onClick={() => rmItem(it._k)} />
                    </div>
                  </div>
                  {it.origen === "servicio" && (
                    <div className="ml-1 mt-1.5 space-y-1.5 border-l-2 border-neutral-100 pl-3">
                      {(it.repuestos ?? []).map((r, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col gap-1.5 text-[12px] text-neutral-600 sm:flex-row sm:items-center sm:gap-2"
                        >
                          <span className="flex-1 truncate">{r.nombre}</span>
                          <div className="flex items-center gap-2">
                            <Input
                              className="w-16 text-right tabular-nums"
                              type="number"
                              min={1}
                              value={r.cantidad}
                              onChange={(e) =>
                                updRepuestoUsado(
                                  it._k,
                                  idx,
                                  Number(e.target.value) || 1,
                                )
                              }
                            />
                            <IconButton aria-label="Quitar" icon={Trash2} variant="danger-ghost" size="sm" onClick={() => rmRepuestoUsado(it._k, idx)} className="rounded" />
                          </div>
                        </div>
                      ))}
                      <Select
                        key={it.repuestos?.length ?? 0}
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) addRepuestoUsado(it._k, e.target.value);
                        }}
                        className="h-7 w-full text-[11px] text-neutral-500 sm:w-56"
                        aria-label="Agregar repuesto usado"
                      >
                        <option value="">+ Repuesto usado…</option>
                        {repuestos.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre} ({r.stock} en stock)
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              ))}
              <div
                className="flex items-center justify-between gap-2 rounded-lg px-5 py-2"
                style={{ backgroundColor: "var(--accent-soft)" }}
              >
                <span className="text-sm font-semibold uppercase tracking-wide text-neutral-900">
                  Total
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {fmtUsd(totalPrecio)}
                </span>
              </div>
            </div>
          )}
        </Card>
        </div>

        <Card className="p-4">
          <Eyebrow>Pago</Eyebrow>

          <div className="space-y-2">
            {pagos.map((p) => {
              const recargoPct = p.recargoPct ?? 0;
              const cajasMedio = p.medio !== "cuenta_corriente" ? cajasDeMedio(p.medio) : [];
              return (
                <div key={p._k} className="space-y-1.5 rounded-lg border border-neutral-200 p-3">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                    <Select
                      value={p.medio}
                      onChange={(e) => {
                        const medio = e.target.value as MedioPagoVenta;
                        updPago(p._k, { ...medioAPago(medio), canje: undefined });
                        if (medio === "canje") setCanjeModalKey(p._k);
                      }}
                      className="w-full sm:w-40"
                      aria-label="Medio de pago"
                    >
                      {!modoDemo && (
                        <option value="cuenta_corriente">
                          {medioPagoCfg.cuenta_corriente.emoji} Cuenta corriente
                        </option>
                      )}
                      {mediosDisponibles.map((m) => (
                        <option key={m} value={m}>
                          {medioPagoCfg[m].emoji} {medioPagoCfg[m].label}
                        </option>
                      ))}
                    </Select>
                    {cajasMedio.length > 0 && (
                      <Select
                        value={p.cajaId}
                        onChange={(e) => {
                          const caja = cajasMedio.find((c) => c.id === e.target.value);
                          if (caja) updPago(p._k, { cajaId: caja.id, caja: caja.moneda });
                        }}
                        className="w-full sm:w-36"
                        aria-label="Caja"
                      >
                        {cajasMedio.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </Select>
                    )}
                    <div className="flex items-center gap-2 sm:min-w-[12rem] sm:flex-1">
                      {p.caja === "ars" ? (
                        <div className="flex h-9 flex-1 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-sm transition-colors focus-within:border-accent">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Cobrado $"
                            className="min-w-0 flex-1 text-right tabular-nums outline-none"
                            value={p.montoUsd ? fmtNum(Math.round(p.montoUsd * dolarVenta)) : ""}
                            onChange={(e) => {
                              const raw = Number(e.target.value.replace(/\D/g, "")) || 0;
                              updPago(p._k, { montoUsd: raw / dolarVenta });
                            }}
                          />
                          {p.montoUsd > 0 && (
                            <span className="shrink-0 text-[11px] text-neutral-500">
                              ≈ {fmtUsd(p.montoUsd)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Input
                          className="flex-1 text-right tabular-nums"
                          type="text"
                          inputMode="numeric"
                          placeholder="Cobrado U$"
                          value={p.montoUsd ? fmtNum(Math.round(p.montoUsd)) : ""}
                          onChange={(e) => {
                            const raw = Number(e.target.value.replace(/\D/g, "")) || 0;
                            updPago(p._k, { montoUsd: raw });
                          }}
                        />
                      )}
                      <IconButton aria-label="Quitar medio de pago" icon={Trash2} variant="danger-ghost" size="lg" onClick={() => rmPago(p._k)} disabled={pagos.length === 1} />
                    </div>
                  </div>
                  {recargoPct > 0 && p.montoUsd > 0 && (
                    <p className="pl-1 text-[11px] text-amber-600">
                      + {recargoPct}% recargo → cobra{" "}
                      {fmtUsd(montoConRecargo(p.montoUsd, recargoPct))}
                    </p>
                  )}
                  {p.medio === "canje" &&
                    (p.canje ? (
                      <div className="flex items-center gap-2 pl-1 text-[11px] text-neutral-500">
                        <span className="truncate">📦 {p.canje.equipo}</span>
                        <button
                          type="button"
                          onClick={() => setCanjeModalKey(p._k)}
                          className="font-semibold text-accent hover:underline"
                        >
                          Editar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pl-1 text-[11px] text-amber-600">
                        <span>Falta completar el equipo canjeado</span>
                        <button
                          type="button"
                          onClick={() => setCanjeModalKey(p._k)}
                          className="font-semibold underline"
                        >
                          Completar
                        </button>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={addPago}
              disabled={pagos.length >= destinos.length}
              className="text-xs font-medium text-accent hover:underline disabled:opacity-40"
            >
              + Agregar medio
            </button>
            {Math.abs(restante) < 0.005 ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <Check className="h-3.5 w-3.5" /> Pago completo
              </span>
            ) : (
              <span className="flex items-center gap-2 text-xs font-semibold">
                <span className={restante > 0 ? "text-amber-600" : "text-red-500"}>
                  {restante > 0 ? "Faltan " : "Sobran "}
                  {fmtUsd(Math.abs(restante))}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={saldar}>
                  Saldar
                </Button>
              </span>
            )}
          </div>
        </Card>
      </div>

      <CanjeModal
        key={canjeModalKey ?? "canje-none"}
        open={!!canjeModalKey}
        onClose={() => setCanjeModalKey(null)}
        initial={pagos.find((p) => p._k === canjeModalKey)?.canje}
        onSave={(canje) => {
          if (canjeModalKey) updPago(canjeModalKey, { canje });
          setCanjeModalKey(null);
        }}
      />

      <Dialog
        open={confirmMonto}
        onClose={() => setConfirmMonto(false)}
        title="El monto no coincide"
        footer={
          <>
            {errorCrear && (
              <p className="mr-auto text-sm text-red-600">{errorCrear}</p>
            )}
            <Button
              onClick={onClose}
              variant="outline" fullOnMobile
            >
              Cancelar
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setConfirmMonto(false);
                submit();
              }}
              variant="primary" fullOnMobile
            >
              Confirmar de todas formas
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          Cargaste {fmtUsd(totalPrecio - restante)} en pagos, pero el total de la venta es{" "}
          {fmtUsd(totalPrecio)} ({restante > 0 ? "faltan" : "sobran"}{" "}
          {fmtUsd(Math.abs(restante))}). ¿Confirmar la venta igual?
        </p>
      </Dialog>
    </Dialog>
  );
}

function CanjeModal({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: CanjeEquipo;
  onSave: (canje: CanjeEquipo) => void;
}) {
  const [marca, setMarca] = useState(initial?.marca ?? "");
  const [equipo, setEquipo] = useState(initial?.equipo ?? "");
  const [imei, setImei] = useState(initial?.imei ?? "");
  const [checklist, setChecklist] = useState<Checklist>(initial?.checklist ?? CHECKLIST_VACIO);
  const [aclaraciones, setAclaraciones] = useState(initial?.aclaraciones ?? "");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="3xl"
      title="Equipo recibido en canje"
      description="Se guarda como una compra al confirmar la venta"
      footer={
        <>
          <Button
            onClick={onClose}
            variant="outline" fullOnMobile
          >
            Cancelar
          </Button>
          <Button
            disabled={!equipo.trim()}
            onClick={() => onSave({ marca, equipo, imei, checklist, aclaraciones })}
            variant="primary" fullOnMobile
          >
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Datos del equipo
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Marca">
                <Input
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Apple"
                />
              </Field>
              <Field label="Equipo">
                <Input
                  value={equipo}
                  onChange={(e) => setEquipo(e.target.value)}
                  placeholder="iPhone 13 Pro 128GB"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Serial / IMEI (opcional)">
                <Input value={imei} onChange={(e) => setImei(e.target.value)} />
              </Field>
              <Field label="Color (opcional)">
                <Input
                  value={checklist.color}
                  onChange={(e) => setChecklist((c) => ({ ...c, color: e.target.value }))}
                  placeholder="Ej: Negro"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Checklist de ingreso
          </p>
          <ChecklistEditor
            value={checklist}
            onChange={setChecklist}
            gridClassName="grid-cols-1 sm:grid-cols-2"
          />
        </div>

        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Aclaraciones
          </p>
          <Textarea
            rows={3}
            value={aclaraciones}
            onChange={(e) => setAclaraciones(e.target.value)}
            placeholder="Ej: no incluye cargador ni caja."
          />
        </div>
      </div>
    </Dialog>
  );
}
