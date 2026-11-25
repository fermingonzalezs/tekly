"use client";

import { InputFecha } from "@/components/ui/input-fecha";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  Check,
  FileText,
  ShieldCheck,
  Printer,
  Search,
  ChevronDown,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, GrillaCampos, Input, Select, Textarea } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { SeccionTabla } from "@/components/ui/seccion-tabla";
import {
  GraficoBarrasVerticales,
  GraficoDona,
} from "@/components/seccion/graficos";
import { Pagination } from "@/components/ui/pagination";
import { MenuAcciones, type AccionMenu } from "@/components/ui/menu-acciones";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { VentaConfirmada } from "@/components/ui/venta-confirmada";
import { ChecklistEditor, CHECKLIST_VACIO } from "@/components/ui/checklist-editor";
import {
  ReciboImprimir,
  ReciboLineas,
  ReciboGarantiaItems,
  ReciboNota,
  ReciboNotaLista,
  type ReciboPagina,
} from "@/components/recibos/recibo";
import { medioPago as medioPagoCfg, dotClass, MEDIOS_CAJA, CONDICIONES_CELULAR, esCelularNuevo } from "@/lib/status";
import { erroresCanje, resumenCanje } from "@/lib/canje";
import { fmtUsd, fmtArs, fmtNum, fmtDateSlash } from "@/lib/format";
import { otroCostoPromedio } from "@/lib/otros";
import {
  ajusteDesdePct,
  esVentaRegalo,
  aplicarAjusteVenta,
  calcularMargenPct,
  calcularRestante,
  errorAjuste,
  saldarUltimoPago,
  montoConRecargo,
  montoPagoLabel,
  margenVenta,
  costoUnitarioItem,
  categoriaDe,
  motivoNoConfirmable,
  VENDEDOR_LIBRE_MAX,
  RUBRO_LABEL,
  MODALIDAD_LABEL,
  MODALIDADES,
  type ResumenVentas,
  type GraficosVentas,
} from "@/lib/ventas";
import { TIENDA_NOMBRE_MAX } from "@/lib/tiendas";
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
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { cruzoMinimo, nombreVariante, stockDeVariante } from "@/lib/variantes";
import { filterPill, thDivider } from "@/lib/ui-styles";
import type { DeleteVentaOpts, ItemVendido } from "@/lib/db/ventas";
import type {
  Caja,
  CanjeEquipo,
  Checklist,
  ClienteOpcion,
  ClienteSeleccion,
  Celular,
  MedioPago,
  Notebook,
  MedioPagoVenta,
  ModalidadVenta,
  Tienda,
  TiendaSeleccion,
  OtroItem,
  Pago,
  Repuesto,
  Servicio,
  Variante,
  Venta,
  VentaItem,
} from "@/lib/types";
import type { Negocio } from "@/lib/db/configuracion";
import type { SessionUser } from "@/lib/auth/types";
import { tieneRol } from "@/lib/roles";
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
  // Una venta en 0 (regalo) no tiene margen porcentual.
  if (v.totalUsd <= 0) return "—";
  const m = margenVenta(v.items);
  return m.margenPct === null ? "—" : `${m.margenPct.toFixed(1)}%`;
}

function itemGananciaLabel(i: VentaItem): string {
  return i.costoUsd !== undefined ? fmtUsd((i.precioUsd - i.costoUsd) * i.cantidad) : "—";
}

function itemMargenLabel(i: VentaItem): string {
  // Un regalo (precio 0) no tiene margen: mostrar 0 % mentiría.
  if (i.precioUsd <= 0) return "—";
  return i.costoUsd !== undefined
    ? `${calcularMargenPct(i.precioUsd, i.costoUsd).toFixed(1)}%`
    : "—";
}

/** Chip «Regalo» de un ítem (plan 026): chip gris neutro + punto, como el
 * resto de las etiquetas de tabla. */
/** «U$850»: dólares sin espacio entre el símbolo y el número (Nueva venta). */
function usdPegado(n: number): string {
  return "U$" + fmtNum(Math.round(n));
}

function ChipRegalo() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClass.violet)} />
      Regalo
    </span>
  );
}

/** Precio efectivo + precio de lista chico debajo, cuando el descuento tocó
 * la línea. */
function PrecioConLista({ item, className }: { item: VentaItem; className?: string }) {
  return (
    <span className={cn("inline-flex flex-col items-center", className)}>
      <span>{fmtUsd(item.precioUsd)}</span>
      {item.precioListaUsd !== undefined && (
        <span className="text-[11px] font-normal text-neutral-500 tabular-nums">
          lista {fmtUsd(item.precioListaUsd)}
        </span>
      )}
    </span>
  );
}

/** Línea chica de la diferencia/regalo debajo del total (lista y mobile). */
function DiferenciaLinea({ venta }: { venta: Venta }) {
  if (venta.regalo) {
    return (
      <span className="block text-[11px] font-normal text-neutral-500">Regalo</span>
    );
  }
  const ajuste = venta.ajusteUsd ?? 0;
  if (ajuste === 0) return null;
  return (
    <span className="block text-[11px] font-normal text-neutral-500">
      {ajuste > 0 ? `−${fmtUsd(ajuste)} desc.` : `+${fmtUsd(-ajuste)} rec.`}
    </span>
  );
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

/** Valor del Select de Vendedor para «Otro (escribir a mano)». */
const VENDEDOR_LIBRE = "__libre__";
/** Valor del Select de Tienda para «+ Nueva tienda…». */
const TIENDA_NUEVA = "__nueva__";

/** Payload de "Nueva venta" -- el mismo que recibe `createVentaAction`. Se
 * expone para que la demo pueda inyectar su propia implementación. */
export type CrearVentaInput = {
  cliente: Exclude<ClienteSeleccion, { tipo: "libre" }>;
  vendedorId: string;
  vendedorNombre: string;
  /** Tienda / página. Omitido = la principal. */
  tienda?: TiendaSeleccion;
  procedencia?: string;
  modalidad: ModalidadVenta;
  /** Ítems con precio de lista; la diferencia va aparte. */
  items: VentaItem[];
  /** Descuento sobre el total (U$, ≥ 0). El server lo prorratea. */
  ajusteUsd: number;
  /** La venta entera es un regalo (total 0, sin pagos). Nueva venta ya no lo
   * ofrece (los regalos son por ítem); queda por compatibilidad. */
  regalo?: boolean;
  /** Solo para la UI/demo: el server recalcula total y margen. */
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
  eliminarVenta: (id: string, opts: DeleteVentaOpts) => Promise<string | null>;
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
  celulares,
  notebooks,
  otros,
  servicios,
  repuestos,
  vendedores,
  usuariosVenta,
  tiendas = [],
  cajas,
  negocio,
  variantes = [],
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
  celulares: Celular[];
  notebooks: Notebook[];
  otros: OtroItem[];
  servicios: Servicio[];
  repuestos: Repuesto[];
  vendedores: PersonaOpcion[];
  /** Opciones del campo Vendedor de Nueva venta: usuarios activos de la
   * organización (cualquier rol). Default: `vendedores`. */
  usuariosVenta?: PersonaOpcion[];
  /** Tiendas extra de la organización (la principal es `negocio.nombre`). */
  tiendas?: Tienda[];
  cajas: Caja[];
  negocio: Negocio;
  /** Variantes activas de celulares (canje). */
  variantes?: Variante[];
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
  const esAdmin = tieneRol(user, "admin");
  // El vendedor no ve costo/margen de las ventas -- expone el precio de
  // compra (margen = 1 - costo/precio, con el precio visible ya alcanza).
  const puedeVerCosto = tieneRol(user, "admin", "tecnico");

  const searchParams = useSearchParams();
  const router = useRouter();
  const acc: AccionesVentas = acciones ?? {
    crearVenta: createVentaAction,
    eliminarVenta: deleteVentaAction,
    refrescar: () => router.refresh(),
  };
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [openOverride, setOpenOverride] = useState<string | null | undefined>(
    undefined,
  );
  const [qInput, setQInput] = useState(filtros.q);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restituirCelulares, setRestituirCelulares] = useState(true);
  const [restituirRepuestos, setRestituirRepuestos] = useState(true);
  const [eliminarMovimientosCaja, setEliminarMovimientosCaja] = useState(true);
  const [eliminarMovimientoCC, setEliminarMovimientoCC] = useState(true);
  const [eliminarCompraCanje, setEliminarCompraCanje] = useState(true);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Resumen de la venta recién confirmada (check grande); `null` = oculto. */
  const [ventaOk, setVentaOk] = useState<string | null>(null);
  const [recibo, setRecibo] = useState<
    | { venta: Venta; tipo: "venta" }
    | { venta: Venta; tipo: "ambos" }
    | { venta: Venta; tipo: "garantia"; item?: VentaItem }
    | null
  >(null);

  const celularesPorId = useMemo(
    () => new Map(celulares.map((e) => [e.id, e])),
    [celulares],
  );
  const notebooksPorId = useMemo(
    () => new Map(notebooks.map((n) => [n.id, n])),
    [notebooks],
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
        const avisoEliminar = await acc.eliminarVenta(id, {
          restituirCelulares,
          restituirRepuestos,
          eliminarMovimientosCaja,
          eliminarMovimientoCC,
          eliminarCompraCanje,
        });
        if (avisoEliminar) setAviso(avisoEliminar);
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
            serial: i.celularId
              ? celularesPorId.get(i.celularId)?.imei
              : i.notebookId
                ? notebooksPorId.get(i.notebookId)?.numeroSerie
                : undefined,
            garantia: i.celularId
              ? negocio.garantiaTexto || "—"
              : i.notebookId
                ? notebooksPorId.get(i.notebookId)?.garantia || negocio.garantiaTexto || "—"
                : "—",
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
    recibo?.tipo === "venta" || recibo?.tipo === "ambos"
      ? [
          {
            titulo: "Recibo",
            sello: "recibo" as const,
            children: (
              <>
                <ReciboLineas
                  titulo="Detalle"
                  forzarTabla
                  lineas={recibo.venta.items.map((i) => ({
                    detalle: i.detalle,
                    cantidad: i.cantidad,
                    // Precio de lista: el descuento va como ajuste aparte.
                    montoUsd: i.cantidad * (i.precioListaUsd ?? i.precioUsd),
                    montoLabel: i.regalo ? "Regalo" : undefined,
                    serial: i.celularId
                      ? celularesPorId.get(i.celularId)?.imei
                      : i.notebookId
                        ? notebooksPorId.get(i.notebookId)?.numeroSerie
                        : undefined,
                  }))}
                  ajustes={
                    recibo.venta.regalo
                      ? undefined
                      : recibo.venta.ajusteUsd
                        ? [
                            {
                              label: recibo.venta.ajusteUsd > 0 ? "Descuento" : "Recargo",
                              montoUsd: Math.abs(recibo.venta.ajusteUsd),
                              resta: recibo.venta.ajusteUsd > 0,
                            },
                          ]
                        : undefined
                  }
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
          // «Recibo y garantía»: la garantía de toda la venta (una tabla con
          // todos los productos) en una hoja aparte del mismo documento.
          ...(recibo.tipo === "ambos"
            ? [
                {
                  titulo: "Garantía",
                  compacto: true,
                  sello: "garantia" as const,
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
            sello: "garantia" as const,
            children: garantiaContenido(recibo.item ? [recibo.item] : recibo.venta.items),
          },
        ]
      : undefined;

  return (
    <>
      {aviso && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{aviso}</span>
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="shrink-0 font-semibold text-amber-800 hover:underline"
          >
            Cerrar
          </button>
        </div>
      )}
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
            {puedeVerCosto && (
              <StatCard
                align="left"
                label="Ganancia"
                value={resumen.gananciaUsd !== null ? fmtUsd(resumen.gananciaUsd) : "—"}
                hint={resumen.gananciaUsd === null ? "sin costos cargados" : undefined}
                delta={
                  resumen.gananciaUsd !== null
                    ? delta(resumen.gananciaUsd, resumenAnterior?.gananciaUsd ?? undefined)
                    : undefined
                }
                deltaHint={deltaHint}
              />
            )}
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
            {!puedeVerCosto && (
              <StatCard
                align="left"
                label="Ticket promedio"
                value={fmtUsd(resumen.ticketPromedio)}
                delta={delta(resumen.ticketPromedio, resumenAnterior?.ticketPromedio)}
                deltaHint={deltaHint}
              />
            )}
          </>
        }
        filtros={
          <BarraFiltros
            contadorFiltros={filtrosActivos}
            tabs={
              <Tabs
                value={filtros.vista}
                onChange={(v) => actualizar({ vista: v })}
                className="w-full justify-between md:w-auto md:justify-start"
                options={[
                  { value: "ventas", label: "Ventas", count: totalVentas },
                  { value: "items", label: "Ítems vendidos", count: totalItems },
                ]}
              />
            }
            busqueda={
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
            }
            filtros={
              <>
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
                  <option value="celular">Celulares</option>
                  <option value="servicio">Reparaciones</option>
                  <option value="otro">Accesorios</option>
                  <option value="libre">Otros</option>
                </Select>
                {filtros.preset === "personalizado" && (
                  <div className="flex items-center gap-2">
                    <InputFecha
                      value={filtros.desde}
                      onChange={(v) => actualizar({ desde: v })}
                      className="w-full md:w-36"
                      inputClassName={filterPill}
                      aria-label="Desde"
                    />
                    <span className="text-xs text-neutral-500">a</span>
                    <InputFecha
                      value={filtros.hasta}
                      onChange={(v) => actualizar({ hasta: v })}
                      className="w-full md:w-36"
                      inputClassName={filterPill}
                      aria-label="Hasta"
                    />
                  </div>
                )}
              </>
            }
            accion={
              <Button icon={Plus} onClick={() => setCreating(true)} variant="tonal" fullOnMobile>
                Nueva venta
              </Button>
            }
            chips={
              hayFiltrosActivos(filtros) ? (
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
              ) : undefined
            }
          />
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
              onImprimir={(v, tipo) => setRecibo({ venta: v, tipo })}
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

      <VentaConfirmada detalle={ventaOk} onClose={() => setVentaOk(null)} />

      <NuevaVentaDialog
        key={creating ? "abierto" : "cerrado"}
        open={creating}
        onClose={() => setCreating(false)}
        clientesOpciones={clientesOpciones}
        celulares={celulares}
        notebooks={notebooks}
        otros={otros}
        servicios={servicios}
        repuestos={repuestos}
        vendedores={usuariosVenta ?? vendedores}
        tiendas={tiendas}
        cajas={cajas}
        negocio={negocio}
        variantes={variantes}
        dolarVenta={dolarVenta}
        user={user}
        crearVenta={acc.crearVenta}
        modoDemo={modoDemo}
        onCreate={(v) => {
          setCreating(false);
          setVentaOk(
            [v.id, v.cliente, v.regalo ? "Regalo" : "U$" + fmtNum(Math.round(v.totalUsd))].join(" · "),
          );
          if (v.avisoCanje) setAviso(v.avisoCanje);
          publish({
            type: "sale_confirmed",
            actor: v.vendedor,
            amountUsd: v.totalUsd,
            ref: v.id,
            cliente: v.cliente,
          });
          // Stock bajo: unidades de la venta por variante. `celulares` es la
          // foto previa (la venta las deja vendidas), así el «antes» es el
          // stock actual y el «después» descuenta las vendidas.
          const vendidas = new Map<string, number>();
          for (const item of v.items) {
            const unidad = item.celularId
              ? celulares.find((c) => c.id === item.celularId)
              : item.notebookId
                ? notebooks.find((n) => n.id === item.notebookId)
                : undefined;
            if (!unidad?.varianteId) continue;
            vendidas.set(unidad.varianteId, (vendidas.get(unidad.varianteId) ?? 0) + 1);
          }
          for (const [id, cantidad] of vendidas) {
            const variante = variantes.find((x) => x.id === id);
            if (!variante) continue;
            const unidades = variante.categoria === "notebook" ? notebooks : celulares;
            const antes = stockDeVariante(variante, unidades).disponibles;
            const despues = antes - cantidad;
            if (cruzoMinimo(antes, despues, variante.stockMinimo)) {
              publish({
                type: "low_stock",
                actor: user.nombre,
                part: nombreVariante(variante, { cualquierColor: true }),
                qty: despues,
              });
            }
          }
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
                    setRestituirCelulares(true);
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
                onImprimir={(tipo) => setRecibo({ venta: abierta, tipo })}
              />
            </>
          )
        }
      >
        {abierta && (
          <VentaDetalle
            venta={abierta}
            puedeVerCosto={puedeVerCosto}
            cajas={cajas}
            celulares={celularesPorId}
          />
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
            {abierta.items.some((i) => i.celularId || i.notebookId || i.otroId) && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={restituirCelulares}
                  onChange={(e) => setRestituirCelulares(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Devolver al inventario lo vendido o regalado (celulares, notebooks y
                productos de Otros quedan «disponibles» de nuevo)
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
            {abierta.pagos.some(
              (p) => p.medio === "canje" && (p.compraId || p.celularId),
            ) && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={eliminarCompraCanje}
                  onChange={(e) => setEliminarCompraCanje(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Eliminar también la compra de canje y el celular recibido (si
                todavía no se movió del inventario)
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
                recibo.tipo === "garantia" ? (recibo.item?.celularId ?? "full") : ""
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
        className="inline-flex items-center gap-1 uppercase transition-colors hover:text-white/80"
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
  onImprimir,
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
  onImprimir: (v: Venta, tipo: TipoImpresion) => void;
  vacio: boolean;
  hayFiltros: boolean;
  onLimpiar: () => void;
  onNueva: () => void;
}) {
  const colSpan = puedeVerCosto ? 8 : 6;
  return (
    <>
      <div className="space-y-2 md:hidden">
        {ventas.map((v) => (
          <VentaCardMobile
            key={v.id}
            venta={v}
            onOpen={() => onOpen(v.id)}
            onImprimir={(tipo) => onImprimir(v, tipo)}
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
                <th className={cn("px-5 py-3", thDivider)}>Ganancia</th>
              )}
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
              <th className="w-px whitespace-nowrap px-5 py-3 text-center">Acciones</th>
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
                  {v.tienda && (
                    <span className="block max-w-[140px] truncate text-[11px] font-normal text-accent">
                      {v.tienda}
                    </span>
                  )}
                </td>
                <td className="max-w-[160px] truncate px-5 py-2 text-center">{v.cliente}</td>
                <td className="max-w-[260px] truncate px-5 py-2 text-neutral-600 text-center">
                  {v.items.map((i) => i.detalle).join(" · ")}
                </td>
                <td className="px-5 py-2">
                  <PagoChip pagos={v.pagos} />
                </td>
                {puedeVerCosto && (
                  <td className="px-5 py-2 text-center tabular-nums text-neutral-700">
                    {ventaGananciaLabel(v)}
                  </td>
                )}
                {puedeVerCosto && (
                  <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                    {ventaMargenLabel(v)}
                  </td>
                )}
                <td className="px-5 py-2 text-center font-semibold tabular-nums">
                  {fmtUsd(v.totalUsd)}
                  <DiferenciaLinea venta={v} />
                </td>
                <td className="w-px whitespace-nowrap px-5 py-2 text-center">
                  <MenuAcciones
                    label={`Imprimir documentos de ${v.id}`}
                    acciones={accionesImpresion((tipo) => onImprimir(v, tipo))}
                  />
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
  const colSpan = puedeVerCosto ? 8 : 6;
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
              <span className="flex shrink-0 items-center gap-1.5">
                {i.regalo && <ChipRegalo />}
                <span className="text-xs text-neutral-500">{RUBRO_LABEL[categoriaDe(i)]}</span>
              </span>
            </div>
            {serial && (
              <p className="mt-0.5 font-mono text-xs text-neutral-500">{serial}</p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-neutral-500">
                {puedeVerCosto && `Margen ${itemMargenLabel(i)}`}
              </span>
              <PrecioConLista item={i} className="text-sm font-semibold tabular-nums" />
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
              <th className={cn("px-5 py-3", thDivider)}>IMEI/Serial</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Precio</th>
              {puedeVerCosto && (
                <th className={cn("px-5 py-3 text-center", thDivider)}>Ganancia</th>
              )}
              {puedeVerCosto && (
                <th className={cn("px-5 py-3 text-center", thDivider)}>Margen</th>
              )}
              <th className="w-px whitespace-nowrap px-5 py-3 text-center">Acciones</th>
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
                <td className="max-w-[160px] truncate px-5 py-2 text-center">{v.cliente}</td>
                <td className="max-w-[260px] px-5 py-2 text-center">
                  <span className="flex items-center justify-center gap-2">
                    <span className="truncate">{i.detalle}</span>
                    {i.regalo && <ChipRegalo />}
                  </span>
                </td>
                <td className="px-5 py-2 font-mono text-xs tabular-nums text-neutral-500">
                  {serial ?? "—"}
                </td>
                <td className="px-5 py-2 text-center tabular-nums">
                  <PrecioConLista item={i} />
                </td>
                {puedeVerCosto && (
                  <td className="px-5 py-2 text-center tabular-nums text-neutral-700">
                    {itemGananciaLabel(i)}
                  </td>
                )}
                {puedeVerCosto && (
                  <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                    {itemMargenLabel(i)}
                  </td>
                )}
                <td className="w-px whitespace-nowrap px-5 py-2 text-center">
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
  onImprimir,
  puedeVerCosto,
}: {
  venta: Venta;
  onOpen: () => void;
  onImprimir: (tipo: TipoImpresion) => void;
  puedeVerCosto: boolean;
}) {
  return (
    <Card onClick={onOpen} className="cursor-pointer overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 bg-table-header px-4 py-2 text-white">
        <span className="text-sm font-semibold">{v.id}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70">{v.fecha}</span>
          <MenuAcciones
            label={`Imprimir documentos de ${v.id}`}
            acciones={accionesImpresion(onImprimir)}
          />
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
                Ganancia {ventaGananciaLabel(v)} · Margen {ventaMargenLabel(v)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-center border-l border-neutral-100 pl-3">
          <p className="text-base font-semibold tabular-nums">{fmtUsd(v.totalUsd)}</p>
          <DiferenciaLinea venta={v} />
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────── Imprimir (menú) ───────────────────────────

/** Tipos de impresión de una venta: el recibo solo, la garantía de toda la
 * venta (una tabla con todos los productos) sola, o los dos juntos en un
 * mismo documento (recibo + hoja de garantía). */
type TipoImpresion = "venta" | "garantia" | "ambos";

function accionesImpresion(
  onImprimir: (tipo: TipoImpresion) => void,
): AccionMenu[] {
  return [
    { label: "Recibo y garantía (juntos)", icon: Printer, onClick: () => onImprimir("ambos") },
    { label: "Solo recibo", icon: FileText, onClick: () => onImprimir("venta") },
    { label: "Solo garantía", icon: ShieldCheck, onClick: () => onImprimir("garantia") },
  ];
}

function ImprimirMenu({
  onImprimir,
}: {
  onImprimir: (tipo: TipoImpresion) => void;
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
          className="animate-fade-in absolute bottom-full right-0 z-10 mb-1 w-60 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
        >
          {accionesImpresion(onImprimir).map((a) => (
            <button
              key={a.label}
              role="menuitem"
              onClick={() => {
                a.onClick();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 focus:bg-neutral-100 focus:outline-none"
            >
              <a.icon className="h-4 w-4 text-neutral-500" /> {a.label}
            </button>
          ))}
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
  celulares,
}: {
  venta: Venta;
  puedeVerCosto: boolean;
  cajas: Caja[];
  celulares: Map<string, Celular>;
}) {
  const metaFields: { label: string; value: string }[] = [
    { label: "Cliente", value: venta.cliente },
    { label: "Vendedor", value: venta.vendedor },
    ...(venta.tienda ? [{ label: "Tienda", value: venta.tienda }] : []),
    ...(venta.procedencia
      ? [{ label: "Procedencia", value: venta.procedencia }]
      : []),
    { label: "Modalidad", value: MODALIDAD_LABEL[venta.modalidad] },
    {
      label: "Tipo",
      value:
        venta.tipo === "venta" ? "Venta de celulares" : "Reparación / servicio",
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
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="min-w-0 truncate text-sm text-neutral-900">{i.detalle}</span>
                {i.regalo && !venta.regalo && <ChipRegalo />}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                ×{i.cantidad}
              </span>
              <span className="flex shrink-0 flex-col items-end text-sm font-semibold tabular-nums">
                {fmtUsd(i.cantidad * i.precioUsd)}
                {i.precioListaUsd !== undefined && (
                  <span className="text-[11px] font-normal text-neutral-500">
                    lista {fmtUsd(i.cantidad * i.precioListaUsd)}
                  </span>
                )}
              </span>
            </div>
          ))}
          {!!venta.ajusteUsd && (
            <>
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] text-neutral-600">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {fmtUsd(venta.totalUsd + venta.ajusteUsd)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] text-neutral-600">
                <span>{venta.ajusteUsd > 0 ? "Descuento" : "Recargo"}</span>
                <span className="tabular-nums">
                  {venta.ajusteUsd > 0 ? "−" : "+"}
                  {fmtUsd(Math.abs(venta.ajusteUsd))}
                </span>
              </div>
            </>
          )}
          <div
            className="flex items-center justify-between gap-2 px-3 py-2"
            style={{ backgroundColor: "var(--accent-soft)" }}
          >
            <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-900">
              Total
              {venta.regalo && <ChipRegalo />}
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
                <th className={cn("px-4 py-2 text-center", thDivider)}>Cant</th>
                {puedeVerCosto && (
                  <th className={cn("px-4 py-2 text-center", thDivider)}>Costo</th>
                )}
                <th className={cn("px-4 py-2 text-center", thDivider)}>Precio</th>
                <th className="px-4 py-2 text-center">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {venta.items.map((i, idx) => (
                <tr key={idx} className="border-t border-neutral-100 first:border-t-0">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center justify-center gap-2">
                      <span className="truncate">{i.detalle}</span>
                      {i.regalo && !venta.regalo && <ChipRegalo />}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums">{i.cantidad}</td>
                  {puedeVerCosto && (
                    <td className="px-4 py-2.5 text-center tabular-nums text-neutral-500">
                      {i.costoUsd !== undefined ? fmtUsd(i.costoUsd) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-center tabular-nums">
                    <PrecioConLista item={i} />
                  </td>
                  <td className="px-4 py-2.5 text-center font-semibold tabular-nums">
                    {fmtUsd(i.cantidad * i.precioUsd)}
                    {i.precioListaUsd !== undefined && (
                      <span className="block text-[11px] font-normal text-neutral-500">
                        lista {fmtUsd(i.cantidad * i.precioListaUsd)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!!venta.ajusteUsd && (
                <>
                  <tr className="border-t border-neutral-100 text-neutral-600">
                    <td
                      className="px-4 py-2 text-[13px]"
                      colSpan={puedeVerCosto ? 4 : 3}
                    >
                      Subtotal
                    </td>
                    <td className="px-4 py-2 text-center text-[13px] tabular-nums">
                      {fmtUsd(venta.totalUsd + venta.ajusteUsd)}
                    </td>
                  </tr>
                  <tr className="border-t border-neutral-100 text-neutral-600">
                    <td
                      className="px-4 py-2 text-[13px]"
                      colSpan={puedeVerCosto ? 4 : 3}
                    >
                      {venta.ajusteUsd > 0 ? "Descuento" : "Recargo"}
                    </td>
                    <td className="px-4 py-2 text-center text-[13px] tabular-nums">
                      {venta.ajusteUsd > 0 ? "−" : "+"}
                      {fmtUsd(Math.abs(venta.ajusteUsd))}
                    </td>
                  </tr>
                </>
              )}
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
                <td className="px-4 py-2.5 text-center tabular-nums">
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
                  {p.medio !== "canje" && (
                    <span className="text-xs text-neutral-500">
                      {cajaLabel(p, cajas)}
                    </span>
                  )}
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
              {p.medio === "canje" && (
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {p.celularId && celulares.get(p.celularId)?.modelo && (
                    <span className="truncate text-xs text-neutral-500">
                      📦 {celulares.get(p.celularId)?.modelo}
                    </span>
                  )}
                  {p.compraId && (
                    <a
                      href={`/compras?open=${p.compraId}`}
                      className="inline-block text-xs font-semibold text-accent hover:underline"
                    >
                      Ver compra de canje
                    </a>
                  )}
                  {p.celularId &&
                    (() => {
                      const imei = celulares.get(p.celularId)?.imei;
                      const href =
                        imei && imei !== "—"
                          ? `/inventario?tab=celulares&q=${encodeURIComponent(imei)}`
                          : `/inventario?tab=celulares&celular=${p.celularId}`;
                      return (
                        <a
                          href={href}
                          className="inline-block text-xs font-semibold text-accent hover:underline"
                        >
                          Ver celular
                        </a>
                      );
                    })()}
                </div>
              )}
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

type Origen = "celular" | "notebook" | "otro" | "servicio" | "libre";
type DraftItem = VentaItem & { _k: string; origen: Origen };

/** Costo / ganancia / margen de la venta que se está cargando (solo
 * admin/técnico). Los ítems sin costo no entran en el cálculo y se avisan. */
function RentabilidadEnVivo({
  costoUsd,
  gananciaUsd,
  margenPct,
  sinCosto,
}: {
  costoUsd: number;
  gananciaUsd: number;
  margenPct: number | null;
  sinCosto: number;
}) {
  const sinDato = margenPct === null;
  return (
    <div className="rounded-lg border border-neutral-200 px-4 py-2.5">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Costo</p>
          <p className="text-sm font-semibold tabular-nums text-neutral-900">
            {sinDato ? "—" : fmtUsd(costoUsd)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Ganancia</p>
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              sinDato ? "text-neutral-900" : gananciaUsd < 0 ? "text-red-600" : "text-emerald-700",
            )}
          >
            {sinDato ? "—" : fmtUsd(gananciaUsd)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Margen</p>
          <p className="text-sm font-semibold tabular-nums text-neutral-900">
            {sinDato ? "—" : `${margenPct.toFixed(1)}%`}
          </p>
        </div>
      </div>
      {sinCosto > 0 && (
        <p className="mt-1.5 text-center text-[11px] text-neutral-500">
          {sinCosto === 1 ? "1 ítem sin costo cargado no entra" : `${sinCosto} ítems sin costo cargado no entran`} en la ganancia.
        </p>
      )}
    </div>
  );
}
type DraftPago = Pago & { _k: string; canje?: CanjeEquipo };

type CatItem = {
  key: string;
  origen: Exclude<Origen, "libre">;
  refId: string;
  nombre: string;
  /** `undefined` = sin costo conocido (servicios del catálogo). */
  costoUsd?: number;
  precioUsd: number;
  serial?: string;
  /** «Otros» serializado: la unidad puntual que se vende. */
  otroSerial?: string;
  /** «Otros» por cantidad: unidades en stock (tope de líneas en la venta). */
  disponibles?: number;
  /** Repuesto del stock (solo en el buscador de regalos). */
  repuestoId?: string;
};

const origenTone: Record<Origen, "violet" | "blue" | "green" | "gray"> = {
  celular: "violet",
  notebook: "violet",
  otro: "blue",
  servicio: "green",
  libre: "gray",
};
const origenLabel: Record<Origen, string> = {
  celular: "Celular",
  notebook: "Notebook",
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
  celulares,
  notebooks,
  otros,
  servicios,
  yaAgregados,
  onAdd,
  onLibre,
  repuestos = [],
  placeholder = "Buscar por nombre, color o IMEI/serial…",
  listId = "item-buscador-lista",
}: {
  celulares: Celular[];
  notebooks: Notebook[];
  otros: OtroItem[];
  servicios: Servicio[];
  yaAgregados: string[];
  onAdd: (c: CatItem) => void;
  /** Sin esto no se ofrece «Ítem libre» (ej. el buscador de regalos: solo stock). */
  onLibre?: (nombre: string) => void;
  /** Repuestos con stock (el buscador de regalos los ofrece). */
  repuestos?: Repuesto[];
  placeholder?: string;
  /** Id de la lista (accesibilidad): distinto si hay dos buscadores. */
  listId?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useOutsideClick<HTMLDivElement>(() => setOpen(false));
  const inputRef = useRef<HTMLInputElement>(null);

  const catalogo: CatItem[] = useMemo(
    () => [
      ...celulares
        .filter((e) => e.estado === "disponible")
        .map((e) => ({
          key: `e-${e.id}`,
          origen: "celular" as const,
          refId: e.id,
          nombre: `${e.modelo} ${e.almacenamiento} ${e.color}`,
          costoUsd: e.costoUsd,
          precioUsd: e.precioUsd,
          serial: e.imei,
        })),
      ...notebooks
        .filter((n) => n.estado === "disponible")
        .map((n) => ({
          key: `n-${n.id}`,
          origen: "notebook" as const,
          refId: n.id,
          nombre: [
            [n.modelo, n.cpu, n.memoria].filter(Boolean).join(" "),
            n.condicion === "usado"
              ? `Usada${n.bateria !== null ? ` · batería ${n.bateria}%` : ""}`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
          costoUsd: n.costoUsd,
          precioUsd: n.precioUsd,
          serial: n.numeroSerie || undefined,
        })),
      // «Otros»: solo lo que hay en stock. Serializados, una opción por
      // unidad disponible; por cantidad, una opción con su tope.
      ...otros.flatMap((o): CatItem[] =>
        o.serializado
          ? o.unidades
              .filter((u) => (u.estado ?? "disponible") === "disponible")
              .map((u) => ({
                key: "o-" + o.id + "-" + u.serial,
                origen: "otro" as const,
                refId: o.id,
                nombre: [o.nombre, u.color].filter(Boolean).join(" "),
                costoUsd: u.costoUsd,
                precioUsd: o.precioUsd,
                serial: u.serial,
                otroSerial: u.serial,
              }))
          : o.cantidad > 0
            ? [
                {
                  key: "o-" + o.id,
                  origen: "otro" as const,
                  refId: o.id,
                  nombre: o.nombre,
                  costoUsd: otroCostoPromedio(o),
                  precioUsd: o.precioUsd,
                  disponibles: o.cantidad,
                },
              ]
            : [],
      ),
      ...servicios
        .filter((s) => s.activo)
        .map((s) => ({
          key: `s-${s.id}`,
          origen: "servicio" as const,
          refId: s.id,
          nombre: s.nombre,
          // El catálogo no tiene costo: queda sin dato (no 100 % de margen)
          // hasta que se cargue a mano o se sumen repuestos usados.
          costoUsd: undefined,
          precioUsd: s.precioUsd,
        })),
    ],
    [celulares, notebooks, otros, servicios],
  );
  const catalogoRepuestos: CatItem[] = useMemo(
    () =>
      repuestos
        .filter((r) => r.stock > 0)
        .map((r) => ({
          key: "r-" + r.id,
          origen: "otro" as const,
          refId: r.id,
          repuestoId: r.id,
          nombre: [r.nombre, r.modelo].filter(Boolean).join(" · "),
          costoUsd: r.costoUsd,
          precioUsd: 0,
          disponibles: r.stock,
        })),
    [repuestos],
  );

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...catalogo, ...catalogoRepuestos]
      .filter((c) => {
        const coincide =
          c.nombre.toLowerCase().includes(needle) ||
          (c.serial?.toLowerCase().includes(needle) ?? false);
        if (!coincide) return false;
        // `yaAgregados` son claves de stock: id de celular/notebook,
        // «id:serial» de una unidad de Otros, o el id de Otros por cantidad
        // (una vez por línea, hasta su stock).
        if (c.origen === "celular" || c.origen === "notebook") return !yaAgregados.includes(c.refId);
        if (c.otroSerial) return !yaAgregados.includes(c.refId + ":" + c.otroSerial);
        if (c.repuestoId) {
          return yaAgregados.filter((x) => x === "r:" + c.repuestoId).length < (c.disponibles ?? 0);
        }
        if (c.disponibles !== undefined) {
          return yaAgregados.filter((x) => x === c.refId).length < c.disponibles;
        }
        return true;
      })
      .slice(0, 8);
  }, [catalogo, catalogoRepuestos, q, yaAgregados]);

  const libre = onLibre ? q.trim() : "";
  const total = matches.length + (libre ? 1 : 0);

  function elegir(idx: number) {
    if (idx < matches.length) onAdd(matches[idx]);
    else if (libre && onLibre) onLibre(libre);
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
        placeholder={placeholder}
        value={q}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
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
          id={listId}
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
                <Badge tone={c.repuestoId ? "amber" : origenTone[c.origen]}>
                  {c.repuestoId ? "Repuesto" : origenLabel[c.origen]}
                </Badge>
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
  celulares,
  notebooks,
  otros,
  servicios,
  repuestos,
  vendedores,
  tiendas = [],
  cajas,
  negocio,
  variantes = [],
  dolarVenta,
  user,
  crearVenta,
  modoDemo = false,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (v: Venta) => void;
  clientesOpciones: ClienteOpcion[];
  celulares: Celular[];
  notebooks: Notebook[];
  otros: OtroItem[];
  servicios: Servicio[];
  repuestos: Repuesto[];
  vendedores: PersonaOpcion[];
  tiendas?: Tienda[];
  cajas: Caja[];
  negocio: Negocio;
  variantes?: Variante[];
  dolarVenta: number;
  user: SessionUser;
  crearVenta: (input: CrearVentaInput) => Promise<Venta>;
  modoDemo?: boolean;
}) {
  const [cliente, setCliente] = useState<ClienteSeleccion | null>(null);

  // Vendedor: se elige un usuario del sistema o «Otro», y en ese caso el
  // nombre se escribe en la misma casilla. Arranca en el usuario actual.
  const [vendedorSel, setVendedorSel] = useState(
    vendedores.some((v) => v.id === user.id) ? user.id : (vendedores[0]?.id ?? VENDEDOR_LIBRE),
  );
  const [vendedorLibre, setVendedorLibre] = useState("");
  const vendedorEsLibre = vendedorSel === VENDEDOR_LIBRE;
  // Tienda: "" = la principal (nombre del negocio), un id, o TIENDA_NUEVA.
  const [tiendaSel, setTiendaSel] = useState("");
  const [tiendaNueva, setTiendaNueva] = useState("");
  const tienda: TiendaSeleccion =
    tiendaSel === TIENDA_NUEVA
      ? { tipo: "nueva", nombre: tiendaNueva }
      : tiendaSel
        ? { tipo: "existente", id: tiendaSel }
        : { tipo: "principal" };
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
    if (destino === "canje") {
      return { medio: "canje", cajaId: undefined, caja: "usd" };
    }
    const caja = cajasActivas.find((c) => c.id === destino);
    return {
      medio: caja?.medioPago ?? "transferencia",
      cajaId: caja?.id,
      caja: caja?.moneda ?? "usd",
      recargoPct: caja?.recargoPct || undefined,
    };
  };
  const destinoDe = (p: DraftPago) => p.cajaId ?? p.medio;

  const cajasDeMedio = (medio: MedioPago) =>
    cajasActivas.filter((c) => c.medioPago === medio);
  // Medios de caja con alguna caja activa + «Mercadería», que ya no es una
  // caja (plan 020) y se ofrece siempre (salvo en la demo).
  const mediosDisponibles: MedioPagoVenta[] = [
    ...MEDIOS_CAJA.filter((m) => cajasDeMedio(m).length > 0),
    ...(modoDemo ? [] : (["canje"] as const)),
  ];
  // Medios que el negocio todavía no tiene: se muestran deshabilitados con un
  // aviso para crear la caja (sin caja no se sabe adónde fue la plata).
  const mediosSinCaja = MEDIOS_CAJA.filter((m) => cajasDeMedio(m).length === 0);
  const medioAPago = (medio: MedioPagoVenta): Partial<DraftPago> => {
    if (medio === "cuenta_corriente") {
      return {
        medio,
        cajaId: undefined,
        caja: "usd",
        recargoPct: negocio.recargosMediosPago.cuenta_corriente,
      };
    }
    if (medio === "canje") {
      // El canje no es una caja: no pide `cajaId` ni movimiento de caja.
      return {
        medio,
        cajaId: undefined,
        caja: "usd",
        recargoPct: undefined,
        canje: undefined,
      };
    }
    const caja = cajasDeMedio(medio)[0];
    return {
      medio,
      cajaId: caja?.id,
      caja: caja?.moneda ?? "usd",
      recargoPct: caja?.recargoPct || undefined,
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
  // Descuento sobre el total: monto fijo (U$) o porcentaje. Solo descuenta.
  const [descuentoTipo, setDescuentoTipo] = useState<"usd" | "pct">("usd");
  const [descuentoValor, setDescuentoValor] = useState("");
  const [tiendaModal, setTiendaModal] = useState(false);
  const [tiendaModalNombre, setTiendaModalNombre] = useState("");
  const [canjeModalKey, setCanjeModalKey] = useState<string | null>(null);
  const [confirmMonto, setConfirmMonto] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // ── Diferencia (descuento/recargo) y regalo de la venta (plan 026) ──
  const puedeVerCosto = tieneRol(user, "admin", "tecnico");
  const costoRepuesto = (id: string) => repuestos.find((r) => r.id === id)?.costoUsd;
  const subtotalPrecio = items.reduce((a, i) => a + i.cantidad * i.precioUsd, 0);
  // Los regalos (ítems de regalo, del stock) no suman al subtotal ni
  // reciben descuento; conservan su costo, que baja la ganancia.
  const valorDescuento = Number(descuentoValor.replace(",", ".")) || 0;
  const ajustePedido =
    descuentoTipo === "pct" ? ajusteDesdePct(subtotalPrecio, valorDescuento) : valorDescuento;
  const errorAjusteMsg = errorAjuste(subtotalPrecio, ajustePedido);
  const resultadoAjuste = aplicarAjusteVenta(
    items.map((i) => ({ cantidad: i.cantidad, precioUsd: i.precioUsd, regalo: i.regalo })),
    errorAjusteMsg ? 0 : ajustePedido,
  );
  const totalPrecio = resultadoAjuste.totalUsd;
  const ajusteAplicado = resultadoAjuste.ajusteUsd;
  const itemsConCosto = items.map((i, k) => ({
    ...i,
    precioUsd: resultadoAjuste.items[k].precioUsd,
    costoUsd: costoUnitarioItem(i, costoRepuesto),
  }));
  const rentabilidad = margenVenta(itemsConCosto);
  const margenPct = rentabilidad.margenPct ?? 0;
  // Venta de regalo: todos los ítems son regalo → total 0, no se cobra.
  const ventaRegalo = esVentaRegalo(items);
  const pagosEfectivos = ventaRegalo ? [] : pagos;
  // Lo que ya está en la venta, para no ofrecerlo dos veces en los buscadores.
  const clavesStock = items
    .map((i) =>
      i.celularId ??
      i.notebookId ??
      (i.otroId ? (i.otroSerial ? i.otroId + ":" + i.otroSerial : i.otroId) : ""),
    )
    .concat(
      items.flatMap((i) => (i.regalo ? (i.repuestos ?? []).map((r) => "r:" + r.repuestoId) : [])),
    )
    .filter(Boolean);
  const restante = calcularRestante(totalPrecio, pagosEfectivos);
  const clienteNombre = cliente?.nombre ?? "";

  const motivo = motivoNoConfirmable({
    clienteNombre,
    vendedorNombre: vendedorEsLibre
      ? vendedorLibre
      : (vendedores.find((v) => v.id === vendedorSel)?.nombre ?? ""),
    ...(tiendaSel === TIENDA_NUEVA ? { tiendaNueva } : {}),
    items: items.map((i) => ({ detalle: i.detalle, precioUsd: i.precioUsd, regalo: i.regalo })),
    pagos: pagosEfectivos.map((p) => ({
      montoUsd: p.montoUsd,
      medio: p.medio,
      canjeEquipo: p.canje?.modelo,
    })),
    subtotalUsd: subtotalPrecio,
    ajusteUsd: ajustePedido,
    totalPrecio,
  });
  const valid = motivo === null;

  function addCatalogo(c: CatItem) {
    setItems((p) => [
      ...p,
      {
        _k: rid(),
        origen: c.origen,
        celularId: c.origen === "celular" ? c.refId : undefined,
        notebookId: c.origen === "notebook" ? c.refId : undefined,
        otroId: c.origen === "otro" ? c.refId : undefined,
        otroSerial: c.otroSerial,
        detalle: c.nombre,
        cantidad: 1,
        costoUsd: c.costoUsd,
        precioUsd: c.precioUsd,
      },
    ]);
  }
  /** Ítem de regalo, elegido del stock: no se cobra (precio 0) pero
   * conserva su costo, que baja la ganancia de la venta. */
  function addRegalo(c: CatItem) {
    if (c.repuestoId) {
      // Regalo de un repuesto: va como ítem de regalo con el repuesto
      // vinculado (mismo circuito que los «repuestos usados»: descuenta su
      // stock, se devuelve al borrar la venta y su costo entra en la ganancia).
      setItems((p) => [
        ...p,
        {
          _k: rid(),
          origen: "otro",
          detalle: c.nombre,
          cantidad: 1,
          costoUsd: undefined,
          precioUsd: 0,
          regalo: true,
          repuestos: [{ repuestoId: c.repuestoId!, nombre: c.nombre, cantidad: 1 }],
        },
      ]);
      return;
    }
    setItems((p) => [
      ...p,
      {
        _k: rid(),
        origen: c.origen,
        celularId: c.origen === "celular" ? c.refId : undefined,
        notebookId: c.origen === "notebook" ? c.refId : undefined,
        otroId: c.origen === "otro" ? c.refId : undefined,
        otroSerial: c.otroSerial,
        detalle: c.nombre,
        cantidad: 1,
        costoUsd: c.costoUsd,
        precioUsd: 0,
        regalo: true,
      },
    ]);
  }
  const updItem = (k: string, patch: Partial<DraftItem>) =>
    setItems((p) => p.map((i) => (i._k === k ? { ...i, ...patch } : i)));
  const rmItem = (k: string) => setItems((p) => p.filter((i) => i._k !== k));

  const destinos = modoDemo
    ? cajasActivas.map((c) => c.id)
    : ["cuenta_corriente", ...cajasActivas.map((c) => c.id), "canje"];
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
      const vendedorNombre = vendedorEsLibre
        ? vendedorLibre.trim().replace(/\s+/g, " ")
        : (vendedores.find((v) => v.id === vendedorSel)?.nombre ?? "");
      try {
        const venta = await crearVenta({
          cliente,
          vendedorId: vendedorEsLibre ? "" : vendedorSel,
          vendedorNombre,
          tienda,
          procedencia,
          modalidad,
          items: items.map(({ _k, origen, ...i }) => ({
            ...i,
            // El server prorratea la diferencia: se manda el precio de lista.
            costoUsd: costoUnitarioItem(i, costoRepuesto),
            categoria: origen,
          })),
          ajusteUsd: ajusteAplicado,
          totalUsd: totalPrecio,
          pagos: pagosEfectivos.map(({ _k, ...p }) => p),
          margenPct: Math.round(margenPct * 10) / 10,
          tipo: items.some((i) => i.origen === "celular" || i.origen === "notebook")
            ? "venta"
            : "reparacion",
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
      formulario
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
          <GrillaCampos>
            <Field label="Vendedor">
              {vendedorEsLibre ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    value={vendedorLibre}
                    maxLength={VENDEDOR_LIBRE_MAX}
                    onChange={(e) => setVendedorLibre(e.target.value)}
                    placeholder="Nombre del vendedor"
                    aria-label="Nombre del vendedor"
                  />
                  <IconButton
                    aria-label="Volver a la lista de usuarios"
                    title="Volver a la lista de usuarios"
                    icon={ChevronLeft}
                    variant="ghost"
                    onClick={() => {
                      setVendedorLibre("");
                      setVendedorSel(
                        vendedores.some((v) => v.id === user.id)
                          ? user.id
                          : (vendedores[0]?.id ?? VENDEDOR_LIBRE),
                      );
                    }}
                  />
                </div>
              ) : (
                <Select
                  value={vendedorSel}
                  onChange={(e) => {
                    setVendedorSel(e.target.value);
                    if (e.target.value === VENDEDOR_LIBRE) setVendedorLibre("");
                  }}
                  aria-label="Vendedor"
                >
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre}
                    </option>
                  ))}
                  <option value={VENDEDOR_LIBRE}>Otro (escribir a mano)</option>
                </Select>
              )}
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
                {MODALIDADES.map((m) => (
                  <option key={m} value={m}>
                    {MODALIDAD_LABEL[m]}
                  </option>
                    ))}
                  </Select>
                </Field>
              </GrillaCampos>
            </Card>

        <Card className="p-4">
          <Eyebrow>Ítems</Eyebrow>

          <ItemBuscador
            celulares={celulares}
            notebooks={notebooks}
            otros={otros}
            servicios={servicios}
            yaAgregados={clavesStock}
            onAdd={addCatalogo}
          />

          {items.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-[13px] text-neutral-500">
              Buscá arriba cualquier equipo, producto o servicio por su nombre.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {items.map((it) => (
                  <li key={it._k} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="shrink-0 tabular-nums text-neutral-500">{it.cantidad}x</span>
                    <span className="min-w-0 flex-1 truncate uppercase text-neutral-900">
                      {it.detalle}
                    </span>
                    {it.regalo ? (
                      <ChipRegalo />
                    ) : (
                      <span className="shrink-0 font-semibold tabular-nums">
                        {usdPegado(it.cantidad * it.precioUsd)}
                      </span>
                    )}
                    <IconButton
                      aria-label={`Quitar ${it.detalle}`}
                      icon={Trash2}
                      variant="danger-ghost"
                      size="sm"
                      onClick={() => rmItem(it._k)}
                    />
                  </li>
                ))}
              </ul>

              <ItemBuscador
                celulares={[]}
                notebooks={[]}
                otros={otros}
                servicios={[]}
                yaAgregados={clavesStock}
                repuestos={repuestos}
                onAdd={addRegalo}
                placeholder="🎁 Agregar regalo: repuesto u otro producto del stock"
                listId="regalo-buscador-lista"
              />

              <div className="space-y-1.5 rounded-lg border border-neutral-200 px-4 py-2">
                <div className="flex items-center justify-between gap-2 text-[13px] text-neutral-600">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{usdPegado(subtotalPrecio)}</span>
                </div>
                {!ventaRegalo && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-neutral-600">
                  <span>Descuento</span>
                  {/* Una sola casilla de ancho fijo: tipo (U$ / %), valor y, con %,
                      el monto resultante adentro. Así no se mueve al escribir. Los
                      «!» le ganan al estilo de casillas del modo formulario. */}
                  <div className="flex h-9 w-56 items-center rounded-lg border border-neutral-300 bg-white/70 pl-1 pr-3 transition-colors focus-within:border-accent">
                    <select
                      value={descuentoTipo}
                      onChange={(e) => setDescuentoTipo(e.target.value as "usd" | "pct")}
                      className="!h-7 !w-14 shrink-0 cursor-pointer !rounded-md !border-0 !bg-neutral-100 !px-1 text-xs font-semibold text-neutral-800 !text-center ![text-align-last:center] outline-none"
                      aria-label="Tipo de descuento"
                    >
                      <option value="usd">U$</option>
                      <option value="pct">%</option>
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={descuentoValor}
                      onChange={(e) => setDescuentoValor(e.target.value.replace(/[^\d.,]/g, ""))}
                      placeholder="0"
                      className="!h-7 min-w-0 flex-1 !border-0 !bg-transparent !px-2 text-sm !text-center tabular-nums text-neutral-900 outline-none"
                      aria-label={descuentoTipo === "pct" ? "Descuento en porcentaje" : "Descuento en dólares"}
                    />
                    <span className="w-16 shrink-0 text-right text-xs font-medium tabular-nums text-neutral-800">
                      {ajusteAplicado > 0 ? "−" + usdPegado(ajusteAplicado) : ""}
                    </span>
                  </div>
                </div>
                )}
                {!ventaRegalo && errorAjusteMsg && (
                  <p className="text-[11px] text-red-600">{errorAjusteMsg}</p>
                )}
              </div>
              <div
                className="flex items-center justify-between gap-2 rounded-lg px-5 py-2"
                style={{ backgroundColor: "var(--accent-soft)" }}
              >
                <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-900">
                  Total
                  {ventaRegalo && <ChipRegalo />}
                </span>
                <span className="text-sm font-semibold tabular-nums">{usdPegado(totalPrecio)}</span>
              </div>
              {puedeVerCosto && (
                <RentabilidadEnVivo
                  costoUsd={rentabilidad.costoUsd}
                  gananciaUsd={rentabilidad.gananciaUsd}
                  margenPct={rentabilidad.margenPct}
                  sinCosto={itemsConCosto.filter((i) => i.costoUsd === undefined).length}
                />
              )}
            </div>
          )}
        </Card>
        </div>

        <Card className="p-4">
          <Eyebrow>Pago</Eyebrow>

          {ventaRegalo ? (
            <p className="rounded-lg bg-neutral-50 px-3 py-2 text-center text-[13px] text-neutral-600">
              Venta de regalo: todos los ítems son regalo, no se cobra (U$0) y no lleva pagos.
            </p>
          ) : (
          <>
              <div className="space-y-2">
                {pagos.map((p) => {
                  const recargoPct = p.recargoPct ?? 0;
                  const cajasMedio =
                    p.medio !== "cuenta_corriente" && p.medio !== "canje"
                      ? cajasDeMedio(p.medio)
                      : [];
                  return (
                    <div
                      key={p._k}
                      className="overflow-x-auto rounded-lg border border-neutral-200"
                    >
                      <div className="flex min-w-max items-center justify-center gap-2 p-2">
                        <Select
                          value={p.medio}
                          onChange={(e) => {
                            const medio = e.target.value as MedioPagoVenta;
                            updPago(p._k, { ...medioAPago(medio), canje: undefined });
                            if (medio === "canje") setCanjeModalKey(p._k);
                          }}
                          className="w-40 shrink-0 !text-center ![text-align-last:center]"
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
                          {!modoDemo &&
                            mediosSinCaja.map((m) => (
                              <option key={m} value={m} disabled>
                                {medioPagoCfg[m].emoji} {medioPagoCfg[m].label} (sin caja)
                              </option>
                            ))}
                        </Select>
                        {cajasMedio.length > 0 && (
                          <Select
                            value={p.cajaId}
                            onChange={(e) => {
                              const caja = cajasMedio.find((c) => c.id === e.target.value);
                              if (caja)
                                updPago(p._k, {
                                  cajaId: caja.id,
                                  caja: caja.moneda,
                                  recargoPct: caja.recargoPct || undefined,
                                });
                            }}
                            className="w-32 shrink-0 !text-center ![text-align-last:center]"
                            aria-label="Caja"
                          >
                            {cajasMedio.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nombre} · {c.moneda === "ars" ? "$" : "U$"}
                              </option>
                            ))}
                          </Select>
                        )}
                        {p.caja === "ars" ? (
                          <div className="flex h-9 w-52 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-sm transition-colors focus-within:border-accent">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="Cobrado $"
                              aria-label="Monto cobrado en pesos"
                              className="min-w-0 flex-1 !text-center tabular-nums outline-none"
                              value={
                                p.montoUsd ? `$${fmtNum(Math.round(p.montoUsd * dolarVenta))}` : ""
                              }
                              onChange={(e) => {
                                const raw = Number(e.target.value.replace(/\D/g, "")) || 0;
                                updPago(p._k, { montoUsd: raw / dolarVenta });
                              }}
                            />
                            {p.montoUsd > 0 && (
                              <span className="shrink-0 whitespace-nowrap text-[11px] text-neutral-500">
                                ≈ {fmtUsd(p.montoUsd)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Input
                            className="w-32 shrink-0 !text-center tabular-nums"
                            type="text"
                            inputMode="numeric"
                            placeholder={p.medio === "canje" ? "Precio del equipo" : "Cobrado U$"}
                            aria-label={p.medio === "canje" ? "Precio del equipo en canje" : "Monto cobrado en dólares"}
                            value={p.montoUsd ? `U$${fmtNum(Math.round(p.montoUsd))}` : ""}
                            // Canje: el monto es el precio de compra del equipo, se carga en su modal.
                            readOnly={p.medio === "canje"}
                            onClick={
                              p.medio === "canje" ? () => setCanjeModalKey(p._k) : undefined
                            }
                            title={
                              p.medio === "canje" ? "Se edita en el equipo del canje" : undefined
                            }
                            onChange={(e) => {
                              if (p.medio === "canje") return;
                              const raw = Number(e.target.value.replace(/\D/g, "")) || 0;
                              updPago(p._k, { montoUsd: raw });
                            }}
                          />
                        )}
                        {recargoPct > 0 && p.montoUsd > 0 && (
                          <span className="shrink-0 whitespace-nowrap text-[11px] text-amber-600">
                            +{recargoPct}% → {fmtUsd(montoConRecargo(p.montoUsd, recargoPct))}
                          </span>
                        )}
                        {p.medio === "canje" && (
                          <span className="flex max-w-[14rem] shrink-0 items-center gap-1 text-[11px] text-neutral-500">
                            <span className="truncate">
                              📦 {p.canje ? resumenCanje(p.canje) : "Falta el equipo"}
                            </span>
                            <button
                              type="button"
                              onClick={() => setCanjeModalKey(p._k)}
                              className="font-semibold text-accent hover:underline"
                            >
                              {p.canje ? "Editar" : "Completar"}
                            </button>
                          </span>
                        )}
                        <IconButton
                          aria-label="Quitar medio de pago"
                          icon={Trash2}
                          variant="danger-ghost"
                          size="lg"
                          className="shrink-0"
                          onClick={() => rmPago(p._k)}
                          disabled={pagos.length === 1}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
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
            {!modoDemo && mediosSinCaja.length > 0 && (
              <p className="mt-3 text-center text-[11px] text-neutral-500">
                ¿No aparece cómo te pagaron (ej. transferencia en dólares o USDT)? Cada forma de
                cobro es una caja: creala en{" "}
                <a href="/cajas" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                  Cajas
                </a>{" "}
                con su medio y su moneda, y recargá esta pantalla.
              </p>
            )}
          </>
          )}
        </Card>
      </div>

      <CanjeModal
        key={canjeModalKey ?? "canje-none"}
        open={!!canjeModalKey}
        onClose={() => setCanjeModalKey(null)}
        initial={pagos.find((p) => p._k === canjeModalKey)?.canje}
        precioInicial={pagos.find((p) => p._k === canjeModalKey)?.montoUsd ?? 0}
        onSave={(canje, precioUsd) => {
          if (canjeModalKey) updPago(canjeModalKey, { canje, montoUsd: precioUsd });
          setCanjeModalKey(null);
        }}
      />

      <Dialog
        open={tiendaModal}
        onClose={() => setTiendaModal(false)}
        title="Nueva tienda"
        size="lg"
        formulario
        description="Se guarda al confirmar la venta."
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
              variant="primary" fullOnMobile
            >
              Guardar
            </Button>
          </>
        }
      >
        <Field label="Nombre de la tienda">
          <Input
            value={tiendaModalNombre}
            onChange={(e) => setTiendaModalNombre(e.target.value)}
            maxLength={TIENDA_NOMBRE_MAX}
            placeholder="Ej. Heavenstore"
            autoFocus
          />
        </Field>
      </Dialog>

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

// El modo formulario del Dialog deja el contenido de las casillas a la
// izquierda; en el canje se centran todas salvo Modelo y Detalles.
const CENTRADO = "!text-center";
const CENTRADO_SELECT = "!text-center ![text-align-last:center]";

function CanjeModal({
  open,
  onClose,
  initial,
  precioInicial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: CanjeEquipo;
  /** Monto actual del pago «Mercadería» (= precio de compra del equipo). */
  precioInicial: number;
  onSave: (canje: CanjeEquipo, precioUsd: number) => void;
}) {
  const [modelo, setModelo] = useState(initial?.modelo ?? "");
  const [imei, setImei] = useState(initial?.imei ?? "");
  const [color, setColor] = useState(initial?.color ?? "");
  const [condicion, setCondicion] = useState(initial?.condicion ?? "");
  const [bateria, setBateria] = useState(
    initial?.bateria !== undefined ? String(initial.bateria) : "",
  );
  const [precio, setPrecio] = useState(precioInicial > 0 ? String(Math.round(precioInicial)) : "");
  const [detalles, setDetalles] = useState(initial?.detalles ?? "");
  const [testeo, setTesteo] = useState(initial?.testeo ?? false);
  const [checklist, setChecklist] = useState<Checklist>(initial?.checklist ?? CHECKLIST_VACIO);
  const nuevo = esCelularNuevo(condicion);

  const canje: CanjeEquipo = {
    modelo: modelo.trim(),
    imei: imei.trim(),
    color: color.trim(),
    condicion,
    bateria: nuevo || bateria === "" ? undefined : Number(bateria),
    detalles: detalles.trim() || undefined,
    testeo,
    checklist: testeo ? { ...checklist, color: color.trim() } : undefined,
  };
  const precioUsd = Number(precio.replace(/\D/g, "")) || 0;
  const errores = erroresCanje(canje, precioUsd);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size={testeo ? "3xl" : "lg"}
      title="Celular recibido en canje"
      formulario
      description="Queda registrado en Compras / Ingresos. No entra al stock hasta que lo pases desde ahí."
      footer={
        <>
          {errores.length > 0 && (
            <p aria-live="polite" className="mr-auto text-sm text-neutral-500">
              {errores[0]}
            </p>
          )}
          <Button onClick={onClose} variant="outline" fullOnMobile>
            Cancelar
          </Button>
          <Button
            disabled={errores.length > 0}
            onClick={() => onSave(canje, precioUsd)}
            variant="primary"
            fullOnMobile
          >
            Guardar
          </Button>
        </>
      }
    >
      <div
        className={cn(
          "space-y-5",
          testeo && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start lg:gap-6 lg:space-y-0",
        )}
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Datos del equipo
            </p>
            <GrillaCampos>
              <Field label="Modelo" className="sm:col-span-3">
                <Input
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="iPhone 13 Pro 128GB"
                  autoFocus
                />
              </Field>
              <Field label="IMEI / serial" className="sm:col-span-2">
                <Input value={imei} onChange={(e) => setImei(e.target.value)} inputMode="numeric" className={CENTRADO} />
              </Field>
              <Field label="Color">
                <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Negro" className={CENTRADO} />
              </Field>
              <Field label="Estado">
                <Select value={condicion} onChange={(e) => setCondicion(e.target.value)} className={CENTRADO_SELECT}>
                  <option value="">Elegí…</option>
                  {CONDICIONES_CELULAR.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Batería %">
                {nuevo ? (
                  <Input value="" placeholder="No aplica (nuevo)" disabled aria-label="Batería: no aplica en un celular nuevo" className={CENTRADO} />
                ) : (
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={bateria}
                    onChange={(e) => setBateria(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="87"
                    className={cn(CENTRADO, "tabular-nums")}
                  />
                )}
              </Field>
              <Field label="Precio de compra (U$)">
                <Input
                  type="text"
                  inputMode="numeric"
                  className={cn(CENTRADO, "tabular-nums")}
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
                  placeholder="U$"
                />
              </Field>
              <Field label="Detalles (opcional)" className="sm:col-span-3">
                <Textarea
                  rows={3}
                  value={detalles}
                  onChange={(e) => setDetalles(e.target.value)}
                  placeholder="Ej: rayón en la esquina, sin caja ni cargador."
                />
              </Field>
            </GrillaCampos>
            <p className="mt-2 text-[11px] text-neutral-500">
              El precio de compra es lo que se le reconoce al cliente: cubre ese monto de la venta.
            </p>
          </div>
          <label className="flex items-center justify-center gap-2 text-[13px] font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={testeo}
              onChange={(e) => setTesteo(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
            />
            Hacer el testeo del equipo (checklist)
          </label>
        </div>

        {testeo && (
          <div>
            <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Testeo
            </p>
            <ChecklistEditor
              value={checklist}
              onChange={setChecklist}
              gridClassName="grid-cols-1 sm:grid-cols-2"
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
