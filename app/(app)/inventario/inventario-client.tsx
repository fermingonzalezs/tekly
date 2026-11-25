"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  ClipboardCheck,
  Search,
  ChevronDown,
  Tag,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { Field, GrillaCampos, Input, Select, Textarea } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ConfirmarAltaDialog } from "@/components/ui/confirmar-alta-dialog";
import { SeccionTabla } from "@/components/ui/seccion-tabla";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { GraficoDona, GraficoRanking } from "@/components/seccion/graficos";
import {
  CONDICIONES_CELULAR,
  bateriaCelular,
  esCelularNuevo,
  celularStatus,
  otroCategoria,
  repuestoEstado,
  dotClass,
} from "@/lib/status";
import { filterPill, thDivider } from "@/lib/ui-styles";
import { GHOST_STRIPES } from "@/lib/chart";
import { fmtUsd } from "@/lib/format";
import { otroCantidad, otroCostoPromedio } from "@/lib/otros";
import {
  CELULAR_ESTADOS,
  agingCelulares,
  celularesPorEstado,
  notebooksPorEstado,
  resumenCelulares,
  resumenNotebooks,
  resumenOtros,
  resumenRepuestos,
  stockVsMinimo,
  unidadesPorCategoria,
  valorPorCategoria,
  valorPorProveedor,
  coincideCondicion,
  opcionesCondicionCelular,
} from "@/lib/inventario";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";
import type {
  Celular,
  CelularStatus,
  Movimiento,
  Notebook,
  NotebookCondicion,
  OtroCategoria,
  OtroItem,
  OtroUnidad,
  Repuesto,
  Variante,
} from "@/lib/types";
import {
  updateCelularAction,
  deleteCelularAction,
  crearRecuentoCelularesAction,
  updateRepuestoAction,
  crearRecuentoRepuestosAction,
  deleteRepuestoAction,
  updateOtroAction,
  crearRecuentoOtrosAction,
  deleteOtroAction,
  getMovimientosAction,
  updateNotebookAction,
  deleteNotebookAction,
  setVarianteActivaAction,
  deleteVarianteAction,
} from "./actions";
import type { CelularInput, RepuestoInput } from "@/lib/db/inventario";
import type { NotebookInput } from "@/lib/db/notebooks";
import { CopiarTexto } from "@/components/copiar-texto";
import { SelectorVariante } from "@/components/inventario/selector-variante";
import { VarianteDialog } from "@/components/inventario/variante-dialog";
import { VariantesTabla } from "@/components/inventario/variantes-tabla";
import {
  RenombrarGrupoDialog,
  UnirVariantesDialog,
} from "@/components/inventario/variantes-dialogs";
import {
  cruzoMinimo,
  nombreVariante,
  stockDeVariante,
  type UnidadDeVariante,
} from "@/lib/variantes";
import { copyCelular, copyNotebook } from "@/lib/difusion";
import { CopiarSeleccion } from "@/components/copiar-texto";
import { CheckSeleccion } from "@/components/ui/check-seleccion";
import type { MovimientoStockBulk } from "@/lib/db/inventario";
import type { SessionUser } from "@/lib/auth/types";

type Tab = "celulares" | "notebooks" | "repuestos" | "otros";
const CATS: OtroCategoria[] = [
  "ipad",
  "airpods",
  "tablet",
  "accesorio",
  "otro",
];

function MovimientosLog({ movimientos }: { movimientos: Movimiento[] | null }) {
  return (
    <div>
      <p className="mb-2 border-b border-neutral-200 pb-2 text-start text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Movimientos
      </p>

      {/* Mobile: 204px de columnas fijas (fecha+usuario) no dejan lugar al
          detalle -- se apila en su lugar. */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 font-mono md:hidden">
        {movimientos === null ? (
          <p className="px-4 py-3 text-center text-[13px] text-neutral-400">
            Cargando…
          </p>
        ) : movimientos.length === 0 ? (
          <p className="px-4 py-3 text-center text-[13px] text-neutral-400">
            Sin movimientos registrados.
          </p>
        ) : (
          movimientos.map((m, i) => (
            <div
              key={i}
              className="border-t border-neutral-100 px-4 py-2 text-[12px] first:border-t-0"
            >
              <p className="truncate text-neutral-800">{m.detalle}</p>
              <p className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                <span>
                  {m.fecha} · {m.hora}
                </span>
                <span className="truncate text-accent">{m.usuario}</span>
              </p>
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 font-mono md:block">
        <div className="grid grid-cols-[1fr_120px_84px] gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          <span>Movimiento</span>
          <span>Fecha y hora</span>
          <span>Usuario</span>
        </div>
        {movimientos === null ? (
          <p className="px-4 py-3 text-center text-[13px] text-neutral-400">
            Cargando…
          </p>
        ) : movimientos.length === 0 ? (
          <p className="px-4 py-3 text-center text-[13px] text-neutral-400">
            Sin movimientos registrados.
          </p>
        ) : (
          movimientos.map((m, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_120px_84px] items-center gap-2 border-t border-neutral-100 px-4 py-2 text-[12px] first:border-t-0"
            >
              <span className="truncate text-start text-neutral-800">
                {m.detalle}
              </span>
              <span className="text-center text-neutral-500">
                {m.fecha} · {m.hora}
              </span>
              <span className="truncate text-center text-accent">
                {m.usuario}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Trae el historial de movimientos de un ítem cuando su diálogo se abre. */
function useMovimientos(
  itemType: "celular" | "notebook" | "repuesto" | "otro",
  itemId: string | null,
) {
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  useEffect(() => {
    if (!itemId) {
      setMovimientos(null);
      return;
    }
    let cancelado = false;
    setMovimientos(null);
    getMovimientosAction(itemType, itemId).then((m) => {
      if (!cancelado) setMovimientos(m);
    });
    return () => {
      cancelado = true;
    };
  }, [itemType, itemId]);
  return movimientos;
}

export function InventarioClient({
  initialCelulares,
  initialNotebooks,
  initialRepuestos,
  initialOtros,
  initialVariantes,
  movimientos,
  hoy,
  user,
}: {
  initialCelulares: Celular[];
  initialNotebooks: Notebook[];
  initialRepuestos: Repuesto[];
  initialOtros: OtroItem[];
  /** Variantes de celulares, incluidas las desactivadas (la vista agrupada
   * las muestra con «Ver desactivadas»). */
  initialVariantes: Variante[];
  /** Movimientos de stock de la org (ingreso/egreso/baja) -- alimentan el
   *  gráfico de antigüedad de Celulares. */
  movimientos: MovimientoStockBulk[];
  /** "Hoy" en hora de Argentina (server) -- pasarlo evita el mismatch de
   *  hidratación al medir antigüedad con `new Date()` en cada lado. */
  hoy: string;
  user: SessionUser;
}) {
  const { publish } = useRealtime();
  const router = useRouter();
  const esAdmin = user.rol === "admin";
  // Vendedor no ve precios de compra de ítems ya cargados (Costo, Margen,
  // "Valor de stock") -- sí puede seguir cargando un costo al dar de alta
  // o ingresar stock nuevo, porque ahí es él quien lo escribe.
  const puedeVerCosto = user.rol !== "vendedor";
  const [, startDeleteTransition] = useTransition();
  // ?tab=/?q= (búsqueda global de la CommandPalette): la tab inicial y el
  // prefill del buscador se leen de la URL (un resultado de "Celulares" linkea
  // /inventario?tab=celulares&q=...). Acá arriba porque el useState de `q`
  // (más abajo) ya los usa.
  const urlParams = useSearchParams();
  const tabParam = urlParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    tabParam === "notebooks" || tabParam === "repuestos" || tabParam === "otros"
      ? tabParam
      : "celulares",
  );
  const [celulares, setCelulares] = useState<Celular[]>(initialCelulares);
  const [notebooks, setNotebooks] = useState<Notebook[]>(initialNotebooks);
  const [repuestos, setRepuestos] = useState<Repuesto[]>(initialRepuestos);
  const [otros, setOtros] = useState<OtroItem[]>(initialOtros);
  const [variantes, setVariantes] = useState<Variante[]>(initialVariantes);

  // Vista de Celulares: agrupada por grupo › variante (default) o la tabla
  // plana de unidades. Persistida por sección en `localStorage`.
  const [vistaCelulares, setVistaCelulares] = useState<"agrupado" | "unidades">("agrupado");
  const [vistaNotebooks, setVistaNotebooks] = useState<"agrupado" | "unidades">("agrupado");
  const [verVariantesDesactivadas, setVerVariantesDesactivadas] = useState(false);
  const [varianteEditando, setVarianteEditando] = useState<Variante | null>(null);
  const [grupoRenombrando, setGrupoRenombrando] = useState<string | null>(null);
  const [varianteUniendo, setVarianteUniendo] = useState<Variante | null>(null);
  const [varianteEliminando, setVarianteEliminando] = useState<Variante | null>(null);
  const [errorEliminarVariante, setErrorEliminarVariante] = useState<string | null>(null);

  useEffect(() => {
    try {
      const guardada = localStorage.getItem("tekly:ui:inventario-celulares-vista");
      if (guardada === "unidades" || guardada === "agrupado") setVistaCelulares(guardada);
      const guardadaNb = localStorage.getItem("tekly:ui:inventario-notebooks-vista");
      if (guardadaNb === "unidades" || guardadaNb === "agrupado") setVistaNotebooks(guardadaNb);
    } catch {
      // sin localStorage (modo privado): se queda con el default.
    }
  }, []);

  function cambiarVistaNotebooks(vista: "agrupado" | "unidades") {
    setVistaNotebooks(vista);
    try {
      localStorage.setItem("tekly:ui:inventario-notebooks-vista", vista);
    } catch {
      // sin localStorage: queda en memoria.
    }
  }

  function cambiarVistaCelulares(vista: "agrupado" | "unidades") {
    setVistaCelulares(vista);
    try {
      localStorage.setItem("tekly:ui:inventario-celulares-vista", vista);
    } catch {
      // idem
    }
  }

  // Tras editar/unir/borrar una variante se llama `router.refresh()`: los
  // props de la página llegan nuevos pero el `useState` no se reinicia solo.
  useEffect(() => {
    setCelulares(initialCelulares);
  }, [initialCelulares]);
  useEffect(() => {
    setNotebooks(initialNotebooks);
  }, [initialNotebooks]);
  useEffect(() => {
    setVariantes(initialVariantes);
  }, [initialVariantes]);

  // Recuento (Celulares/Repuestos/Otros) siempre en un modal aparte
  // (`recuentoModalTipo` + `RecuentoCelularesModalDialog`/`RecuentoModalDialog`,
  // al final del archivo) -- la tabla nunca cambia de forma al hacer un
  // recuento, todo el conteo se anota en el modal.
  const [recuentoModalTipo, setRecuentoModalTipo] = useState<
    "celulares" | "repuestos" | "otros" | null
  >(null);
  const [q, setQ] = useState(urlParams.get("q") ?? "");
  const [celularFiltro, setCelularFiltro] = useState<"todos" | CelularStatus>(
    "todos",
  );
  const [notebookFiltro, setNotebookFiltro] = useState<"todos" | CelularStatus>(
    "todos",
  );
  // Condición del equipo (Celulares y Notebooks): "todas", "usado" (cualquier
  // grado) o una condición puntual -- ver `coincideCondicion`.
  const [condicionFiltro, setCondicionFiltro] = useState("todas");
  const [repuestoFiltro, setRepuestoFiltro] = useState<
    "todos" | "bajo" | "sin"
  >("todos");
  const [otroFiltro, setOtroFiltro] = useState<"todos" | "serializado">(
    "todos",
  );

  // Selección múltiple para copiar varios textos «para publicar» a la vez.
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  function toggleSel(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleTodos(ids: string[]) {
    setSeleccion((prev) =>
      ids.every((id) => prev.has(id)) ? new Set() : new Set(ids),
    );
  }
  const [openCelularId, setOpenCelularId] = useState<string | null>(null);
  const [openNotebookId, setOpenNotebookId] = useState<string | null>(null);
  const [openRepuestoId, setOpenRepuestoId] = useState<string | null>(null);
  const [openOtroId, setOpenOtroId] = useState<string | null>(null);
  const [expandedOtros, setExpandedOtros] = useState<Set<string>>(new Set());
  const openCelular = celulares.find((e) => e.id === openCelularId) ?? null;
  const openNotebook = notebooks.find((n) => n.id === openNotebookId) ?? null;
  const openRepuesto = repuestos.find((r) => r.id === openRepuestoId) ?? null;
  const openOtro = otros.find((o) => o.id === openOtroId) ?? null;

  function toggleExpandOtro(id: string) {
    setExpandedOtros((p) => {
      const next = new Set(p);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /** Reponer = cargar una compra (plan 025). */
  function reponer(_id: string) {
    router.push("/compras?accion=nueva-compra");
  }

  /** Aviso de stock bajo: solo cuando la variante **cruza** su mínimo hacia
   * abajo con este cambio (se dispara después de que la action confirmó). */
  function avisarStockBajo(
    ids: string[],
    antes: UnidadDeVariante[],
    despues: UnidadDeVariante[],
  ) {
    for (const id of new Set(ids.filter(Boolean))) {
      const variante = variantes.find((v) => v.id === id);
      if (!variante) continue;
      const disponiblesAntes = stockDeVariante(variante, antes).disponibles;
      const disponiblesAhora = stockDeVariante(variante, despues).disponibles;
      if (cruzoMinimo(disponiblesAntes, disponiblesAhora, variante.stockMinimo)) {
        publish({
          type: "low_stock",
          actor: user.nombre,
          part: nombreVariante(variante, { cualquierColor: true }),
          qty: disponiblesAhora,
        });
      }
    }
  }

  function switchTab(t: Tab) {
    setRecuentoModalTipo(null);
    setSeleccion(new Set());
    setQ("");
    setCelularFiltro("todos");
    setNotebookFiltro("todos");
    setCondicionFiltro("todas");
    setRepuestoFiltro("todos");
    setOtroFiltro("todos");
    setTab(t);
  }

  // Sync con ?tab=/?q= (búsqueda global): como efecto, además del useState
  // inicial, para que también funcione ya parado en /inventario (el
  // componente no se remonta en la misma ruta). setTab directo (NO
  // switchTab): switchTab limpia el buscador, y el `q` de la URL es
  // justamente lo que hay que mostrar.
  useEffect(() => {
    const tabParam = urlParams.get("tab");
    const qParam = urlParams.get("q");
    const celularParam = urlParams.get("celular");
    if (celularParam) {
      // Deep link al detalle de un celular (ej. "Ver celular" desde el
      // detalle de una venta con canje, plan 020).
      setTab("celulares");
      setOpenCelularId(celularParam);
    }
    const notebookParam = urlParams.get("notebook");
    if (notebookParam) {
      // Deep link desde el historial de Compras / Ingresos (plan 025).
      setTab("notebooks");
      setOpenNotebookId(notebookParam);
    }
    if (
      tabParam === "celulares" ||
      tabParam === "notebooks" ||
      tabParam === "repuestos" ||
      tabParam === "otros"
    ) {
      setTab(tabParam);
    } else if (tabParam === "equipos") {
      // Links viejos (?tab=equipos) -> Celulares.
      setTab("celulares");
    }
    if (qParam) setQ(qParam);
  }, [urlParams]);

  const needle = q.trim().toLowerCase();
  const celularesFiltrados = celulares.filter(
    (e) =>
      (celularFiltro === "todos" || e.estado === celularFiltro) &&
      coincideCondicion(e.condicion, condicionFiltro) &&
      (!needle ||
        e.modelo.toLowerCase().includes(needle) ||
        e.color.toLowerCase().includes(needle) ||
        e.imei.toLowerCase().includes(needle)),
  );
  const notebooksFiltrados = notebooks.filter(
    (n) =>
      (notebookFiltro === "todos" || n.estado === notebookFiltro) &&
      coincideCondicion(n.condicion, condicionFiltro) &&
      (!needle ||
        n.modelo.toLowerCase().includes(needle) ||
        n.numeroSerie.toLowerCase().includes(needle) ||
        n.cpu.toLowerCase().includes(needle)),
  );
  const repuestosFiltrados = repuestos.filter(
    (r) =>
      (repuestoFiltro === "todos" ||
        (repuestoFiltro === "bajo"
          ? r.stock > 0 && r.stock <= r.stockMin
          : r.stock <= 0)) &&
      (!needle ||
        r.nombre.toLowerCase().includes(needle) ||
        r.sku.toLowerCase().includes(needle) ||
        r.modelo.toLowerCase().includes(needle) ||
        r.proveedor.toLowerCase().includes(needle)),
  );
  const otrosFiltrados = otros.filter(
    (o) =>
      (otroFiltro === "todos" || o.serializado) &&
      (!needle || o.nombre.toLowerCase().includes(needle)),
  );

  const tabOptions = [
    { value: "celulares" as Tab, label: "Celulares", count: celulares.length },
    { value: "notebooks" as Tab, label: "Notebooks", count: notebooks.length },
    { value: "repuestos" as Tab, label: "Repuestos", count: repuestos.length },
    { value: "otros" as Tab, label: "Otros", count: otros.length },
  ];

  // Derivados de la tab activa. Las tarjetas y los gráficos son una foto del
  // inventario completo (no de la búsqueda): el buscador filtra la tabla, no
  // los KPIs.
  const eq = resumenCelulares(celulares);
  const nb = resumenNotebooks(notebooks);
  const notebookSlices = notebooksPorEstado(notebooks);
  const notebookValorPorEstado = CELULAR_ESTADOS.map((estado) => ({
    label: celularStatus[estado].label,
    value: notebooks
      .filter((n) => n.estado === estado)
      .reduce((a, n) => a + n.costoUsd, 0),
  })).filter((b) => b.value > 0);
  const rep = resumenRepuestos(repuestos);
  const ot = resumenOtros(otros);
  const estadoSlices = celularesPorEstado(celulares);
  const agingRows = agingCelulares(celulares, movimientos, hoy);
  const stockMinRows = stockVsMinimo(repuestos);
  const proveedorRows = valorPorProveedor(repuestos);
  const categoriaUnidades = unidadesPorCategoria(otros);
  const categoriaValor = valorPorCategoria(otros);

  /** Acciones de variante de la vista agrupada (Celulares y Notebooks). */
  function cambiarActivaVariante(v: Variante, activa: boolean) {
    setVariantes((p) => p.map((x) => (x.id === v.id ? { ...x, activa } : x)));
    startDeleteTransition(async () => {
      await setVarianteActivaAction(v.id, activa);
      router.refresh();
    });
  }
  const accionesVariante = {
    onEditar: (v: Variante) => setVarianteEditando(v),
    onRenombrarGrupo: (grupo: string) => setGrupoRenombrando(grupo),
    onUnir: (v: Variante) => setVarianteUniendo(v),
    onDesactivar: (v: Variante) => cambiarActivaVariante(v, false),
    onReactivar: (v: Variante) => cambiarActivaVariante(v, true),
    onEliminar: (v: Variante) => setVarianteEliminando(v),
  };

  const busqueda = (
    <div className="relative w-full md:w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          tab === "celulares"
            ? "Buscar por modelo, color o IMEI…"
            : tab === "notebooks"
              ? "Buscar por modelo, serie o CPU…"
              : tab === "repuestos"
                ? "Buscar por nombre, SKU, modelo o proveedor…"
                : "Buscar por nombre…"
        }
        className={cn("w-full pl-9", filterPill)}
        aria-label="Buscar en inventario"
      />
    </div>
  );

  const accion = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {tab !== "notebooks" && (
        <Button
          icon={ClipboardCheck}
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() =>
            setRecuentoModalTipo(tab as "celulares" | "repuestos" | "otros")
          }
        >
          Recuento
        </Button>
      )}
      {/* Plan 025: toda entrada de stock pasa por una compra. */}
      <ButtonLink href="/compras?accion=nueva-compra" icon={Plus} variant="tonal" fullOnMobile>
        Ingresar equipo
      </ButtonLink>
    </div>
  );

  const filtrosTab =
    tab === "celulares" ? (
      <>
        <Tabs
          value={vistaCelulares}
          onChange={(v) => cambiarVistaCelulares(v)}
          options={[
            { value: "agrupado" as const, label: "Agrupado" },
            { value: "unidades" as const, label: "Unidades" },
          ]}
        />
        <Select
          value={celularFiltro}
          onChange={(e) =>
            setCelularFiltro(e.target.value as "todos" | CelularStatus)
          }
          className={cn("w-full md:w-52", filterPill)}
          aria-label="Filtrar por estado"
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS.map((s) => (
            <option key={s} value={s}>
              {celularStatus[s].label}
            </option>
          ))}
        </Select>
        <Select
          value={condicionFiltro}
          onChange={(e) => setCondicionFiltro(e.target.value)}
          className={cn("w-full md:w-56", filterPill)}
          aria-label="Filtrar por condición"
        >
          <option value="todas">Todas las condiciones</option>
          {opcionesCondicionCelular(
            CONDICIONES_CELULAR,
            celulares.map((c) => c.condicion),
          ).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </>
    ) : tab === "notebooks" ? (
      <>
        <Tabs
          value={vistaNotebooks}
          onChange={(v) => cambiarVistaNotebooks(v)}
          options={[
            { value: "agrupado" as const, label: "Agrupado" },
            { value: "unidades" as const, label: "Unidades" },
          ]}
        />
        <Select
          value={notebookFiltro}
          onChange={(e) =>
            setNotebookFiltro(e.target.value as "todos" | CelularStatus)
          }
          className={cn("w-full md:w-52", filterPill)}
          aria-label="Filtrar por estado"
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS.map((s) => (
            <option key={s} value={s}>
              {celularStatus[s].label}
            </option>
          ))}
        </Select>
        <Select
          value={condicionFiltro}
          onChange={(e) => setCondicionFiltro(e.target.value)}
          className={cn("w-full md:w-48", filterPill)}
          aria-label="Filtrar por condición"
        >
          <option value="todas">Todas las condiciones</option>
          <option value="nuevo">Nuevas</option>
          <option value="usado">Usadas</option>
        </Select>
      </>
    ) : tab === "repuestos" ? (
      <Select
        value={repuestoFiltro}
        onChange={(e) =>
          setRepuestoFiltro(e.target.value as "todos" | "bajo" | "sin")
        }
        className={cn("w-full md:w-52", filterPill)}
        aria-label="Filtrar por stock"
      >
        <option value="todos">Todo el stock</option>
        <option value="bajo">Bajo mínimo</option>
        <option value="sin">Sin stock</option>
      </Select>
    ) : (
      <Select
        value={otroFiltro}
        onChange={(e) =>
          setOtroFiltro(e.target.value as "todos" | "serializado")
        }
        className={cn("w-full md:w-52", filterPill)}
        aria-label="Filtrar por tipo"
      >
        <option value="todos">Todos los productos</option>
        <option value="serializado">Serializados</option>
      </Select>
    );

  const filtrosActivos =
    (tab === "celulares"
      ? celularFiltro !== "todos"
      : tab === "notebooks"
        ? notebookFiltro !== "todos"
        : tab === "repuestos"
          ? repuestoFiltro !== "todos"
          : otroFiltro !== "todos")
      ? 1
      : 0;
  const filtrosActivosTotal =
    filtrosActivos +
    ((tab === "celulares" || tab === "notebooks") && condicionFiltro !== "todas" ? 1 : 0);

  return (
    <>
      <SeccionTabla
        id="inventario"
        graficos={
          tab === "celulares" ? (
            <>
              <GraficoDona
                title="Estado de los celulares"
                sub="unidades por estado"
                data={estadoSlices}
                vacio="Sin celulares cargados."
              />
              <GraficoRanking
                title="Antigüedad del stock"
                sub="celulares sin vender, por días desde el ingreso"
                rows={agingRows}
                vacio="Sin registros de ingreso para medir la antigüedad."
              />
            </>
          ) : tab === "notebooks" ? (
            <>
              <GraficoDona
                title="Estado de las notebooks"
                sub="unidades por estado"
                data={notebookSlices}
                vacio="Sin notebooks cargadas."
              />
              <GraficoRanking
                title="Valor por estado"
                sub="a costo"
                rows={notebookValorPorEstado}
                fmt={fmtUsd}
                vacio="Sin notebooks cargadas."
              />
            </>
          ) : tab === "repuestos" ? (
            <>
              <GraficoRanking
                title="Stock vs mínimo"
                sub="unidades en stock · el mínimo va en cada fila"
                rows={stockMinRows}
                vacio="Sin repuestos con stock mínimo definido."
              />
              <GraficoRanking
                title="Valor por proveedor"
                sub="a costo"
                rows={proveedorRows}
                fmt={fmtUsd}
                vacio="Sin repuestos cargados."
              />
            </>
          ) : (
            <>
              <GraficoDona
                title="Unidades por categoría"
                sub="unidades en stock"
                data={categoriaUnidades}
                vacio="Sin productos cargados."
              />
              <GraficoRanking
                title="Valor por categoría"
                sub="a costo"
                rows={categoriaValor}
                fmt={fmtUsd}
                vacio="Sin productos cargados."
              />
            </>
          )
        }
        tarjetas={
          tab === "celulares" ? (
            <>
              <StatCard
                align="left"
                label="Celulares"
                value={eq.total}
                hint="unidades"
              />
              {puedeVerCosto ? (
                <StatCard
                  align="left"
                  label="Valor a costo"
                  value={fmtUsd(eq.valorCosto)}
                  hint="inventario histórico"
                />
              ) : (
                <StatCard
                  align="left"
                  label="Valor de venta"
                  value={fmtUsd(eq.valorVenta)}
                  hint="precio de lista"
                />
              )}
              <StatCard
                align="left"
                label="Disponibles"
                value={eq.disponibles}
                hint="para vender"
              />
              {puedeVerCosto ? (
                <StatCard
                  align="left"
                  label="Capital inmovilizado"
                  value={fmtUsd(eq.capitalInmovilizado)}
                  hint="stock sin vender"
                />
              ) : (
                <StatCard
                  align="left"
                  label="Reservados"
                  value={eq.reservados}
                  hint="turno pendiente"
                />
              )}
            </>
          ) : tab === "notebooks" ? (
            <>
              <StatCard
                align="left"
                label="Notebooks"
                value={nb.total}
                hint="unidades"
              />
              {puedeVerCosto ? (
                <StatCard
                  align="left"
                  label="Valor a costo"
                  value={fmtUsd(nb.valorCosto)}
                  hint="inventario histórico"
                />
              ) : (
                <StatCard
                  align="left"
                  label="Valor de venta"
                  value={fmtUsd(nb.valorVenta)}
                  hint="precio de lista"
                />
              )}
              <StatCard
                align="left"
                label="Disponibles"
                value={nb.disponibles}
                hint="para vender"
              />
              <StatCard
                align="left"
                label="Reservadas"
                value={nb.reservadas}
                hint="turno pendiente"
              />
            </>
          ) : tab === "repuestos" ? (
            <>
              <StatCard
                align="left"
                label="Repuestos"
                value={rep.total}
                hint="SKUs"
              />
              {puedeVerCosto ? (
                <StatCard
                  align="left"
                  label="Valor"
                  value={fmtUsd(rep.valor)}
                  hint="a costo"
                />
              ) : (
                <StatCard
                  align="left"
                  label="Unidades"
                  value={rep.unidades}
                  hint="en stock"
                />
              )}
              <StatCard
                align="left"
                label="Bajo mínimo"
                value={rep.bajoMinimo}
                hint="≤ punto de reposición"
              />
              <StatCard
                align="left"
                label="Sin stock"
                value={rep.sinStock}
                hint="reponer ya"
              />
            </>
          ) : (
            <>
              <StatCard
                align="left"
                label="Ítems"
                value={ot.total}
                hint="productos"
              />
              <StatCard
                align="left"
                label="Unidades"
                value={ot.unidades}
                hint="en stock"
              />
              {puedeVerCosto ? (
                <StatCard
                  align="left"
                  label="Valor"
                  value={fmtUsd(ot.valor)}
                  hint="a costo"
                />
              ) : (
                <StatCard
                  align="left"
                  label="Valor de venta"
                  value={fmtUsd(ot.valorVenta)}
                  hint="precio de lista"
                />
              )}
              <StatCard
                align="left"
                label="Serializados"
                value={ot.serializados}
                hint="con IMEI/serial"
              />
            </>
          )
        }
        filtros={
          <BarraFiltros
            contadorFiltros={filtrosActivosTotal + (q ? 1 : 0)}
            tabs={
              <Tabs
                value={tab}
                onChange={switchTab}
                className="w-full justify-between md:w-auto md:justify-start"
                options={tabOptions}
              />
            }
            busqueda={busqueda}
            filtros={filtrosTab}
            accion={accion}
          />
        }
      >
        {/* ── Celulares ───────────────────────────── */}
        {tab === "celulares" &&
          (() => {
            if (vistaCelulares === "agrupado") {
              const desactivadas = variantes.filter(
                (v) => !v.activa && v.categoria === "celular",
              ).length;
              return (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVerVariantesDesactivadas((v) => !v)}
                    >
                      {verVariantesDesactivadas
                        ? "Ver activas"
                        : `Ver desactivadas (${desactivadas})`}
                    </Button>
                  </div>
                  <VariantesTabla
                    variantes={variantes}
                    celulares={celulares}
                    unidadesFiltradas={celularesFiltrados}
                    hayFiltro={needle !== "" || celularFiltro !== "todos" || condicionFiltro !== "todas"}
                    verDesactivadas={verVariantesDesactivadas}
                    esAdmin={esAdmin}
                    puedeVerCosto={puedeVerCosto}
                    onAbrirUnidad={(id) => setOpenCelularId(id)}
                    onAgregarUnidad={(v) => {
                      router.push(`/compras?accion=nueva-compra&variante=${v.id}`);
                    }}
                    {...accionesVariante}
                  />
                </div>
              );
            }
            return (
              <>
                {celularesFiltrados.some((e) => seleccion.has(e.id)) && (
                  <CopiarSeleccion
                    textos={() =>
                      celularesFiltrados
                        .filter((e) => seleccion.has(e.id))
                        .map(copyCelular)
                    }
                    onLimpiar={() => setSeleccion(new Set())}
                  />
                )}
                <div className="space-y-2 md:hidden">
                  {celularesFiltrados.map((e) => (
                    <Card
                      key={e.id}
                      onClick={() => setOpenCelularId(e.id)}
                      className="cursor-pointer overflow-hidden p-0"
                    >
                      <div className="flex items-center gap-2.5 bg-table-header px-4 py-2 text-white">
                        <CheckSeleccion
                          tono="oscuro"
                          label={`Seleccionar ${e.modelo}`}
                          checked={seleccion.has(e.id)}
                          onChange={() => toggleSel(e.id)}
                        />
                        <p className="truncate text-sm font-semibold">
                          {e.modelo} {e.almacenamiento}
                        </p>
                      </div>
                      <div className="flex items-stretch gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-neutral-500">
                            {e.color} · {e.imei}
                          </p>
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 text-[11px] text-neutral-400">
                            <span>Batería {e.bateria}%</span>
                            {puedeVerCosto && (
                              <span>Costo {fmtUsd(e.costoUsd)}</span>
                            )}
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  dotClass[celularStatus[e.estado].tone],
                                )}
                              />
                              {celularStatus[e.estado].label}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-neutral-100 pl-3">
                          <p className="text-base font-semibold tabular-nums">
                            {fmtUsd(e.precioUsd)}
                          </p>
                          <CopiarTexto texto={copyCelular(e)} />
                        </div>
                      </div>
                    </Card>
                  ))}
                  {celularesFiltrados.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
                      Sin celulares para esta búsqueda.
                    </p>
                  )}
                </div>
                <Card className="hidden overflow-hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                        <th className="w-px py-3 pl-4 pr-0 text-center">
                          <CheckSeleccion
                            label="Seleccionar todos los celulares"
                            tono="oscuro"
                            parcial={celularesFiltrados.some((e) =>
                              seleccion.has(e.id),
                            )}
                            checked={
                              celularesFiltrados.length > 0 &&
                              celularesFiltrados.every((e) =>
                                seleccion.has(e.id),
                              )
                            }
                            onChange={() =>
                              toggleTodos(celularesFiltrados.map((e) => e.id))
                            }
                          />
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Celular
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Color
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Almacenamiento
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          IMEI/Serial
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Batería
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Condición
                        </th>
                        {puedeVerCosto && (
                          <th
                            className={cn("px-5 py-3 text-center", thDivider)}
                          >
                            Costo
                          </th>
                        )}
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Venta
                        </th>
                        {puedeVerCosto && (
                          <th
                            className={cn("px-5 py-3 text-center", thDivider)}
                          >
                            Margen
                          </th>
                        )}
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Estado
                        </th>
                        <th className="w-px px-3 py-3 text-center">
                          <span className="sr-only">
                            Copiar texto para publicar
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {celularesFiltrados.map((e) => (
                        <tr
                          key={e.id}
                          onClick={() => setOpenCelularId(e.id)}
                          className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                        >
                          <td
                            className="w-px py-2 pl-4 pr-0"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <CheckSeleccion
                              label={`Seleccionar ${e.modelo}`}
                              checked={seleccion.has(e.id)}
                              onChange={() => toggleSel(e.id)}
                            />
                          </td>
                          <td className="max-w-[160px] truncate px-5 py-2 text-start font-medium">
                            {e.modelo}
                          </td>
                          <td className="max-w-[110px] truncate px-5 py-2 text-center text-neutral-500">
                            {e.color}
                          </td>
                          <td className="px-5 py-2 text-center tabular-nums">
                            {e.almacenamiento}
                          </td>
                          <td className="px-5 py-2 text-center text-neutral-500">
                            {e.imei}
                          </td>
                          <td className="px-5 py-2 text-center tabular-nums">
                            {e.bateria}%
                          </td>
                          <td className="px-5 py-2 text-center text-neutral-500">
                            {e.condicion}
                          </td>
                          {puedeVerCosto && (
                            <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                              {fmtUsd(e.costoUsd)}
                            </td>
                          )}
                          <td className="px-5 py-2 text-center font-semibold tabular-nums">
                            {fmtUsd(e.precioUsd)}
                          </td>
                          {puedeVerCosto && (
                            <td className="px-5 py-2 text-center tabular-nums text-emerald-600">
                              {(
                                ((e.precioUsd - e.costoUsd) / e.precioUsd) *
                                100
                              ).toFixed(0)}
                              %
                            </td>
                          )}
                          <td className="px-5 py-2 text-center">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  dotClass[celularStatus[e.estado].tone],
                                )}
                              />
                              {celularStatus[e.estado].label}
                            </span>
                          </td>
                          <td className="w-px whitespace-nowrap px-3 py-2 text-center">
                            <CopiarTexto texto={copyCelular(e)} />
                          </td>
                        </tr>
                      ))}
                      {celularesFiltrados.length === 0 && (
                        <tr>
                          <td
                            colSpan={puedeVerCosto ? 12 : 10}
                            className="px-5 py-10 text-center text-sm text-neutral-400"
                          >
                            Sin celulares para esta búsqueda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
              </>
            );
          })()}

        {/* ── Notebooks ─────────────────────────── */}
        {tab === "notebooks" && vistaNotebooks === "agrupado" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVerVariantesDesactivadas((v) => !v)}
              >
                {verVariantesDesactivadas
                  ? "Ver activas"
                  : `Ver desactivadas (${
                      variantes.filter((v) => !v.activa && v.categoria === "notebook").length
                    })`}
              </Button>
            </div>
            <VariantesTabla
              categoria="notebook"
              variantes={variantes}
              notebooks={notebooks}
              unidadesFiltradas={notebooksFiltrados}
              hayFiltro={needle !== "" || notebookFiltro !== "todos" || condicionFiltro !== "todas"}
              verDesactivadas={verVariantesDesactivadas}
              esAdmin={esAdmin}
              puedeVerCosto={puedeVerCosto}
              onAbrirUnidad={(id) => setOpenNotebookId(id)}
              onAgregarUnidad={(v) => {
                router.push(`/compras?accion=nueva-compra&variante=${v.id}`);
              }}
              {...accionesVariante}
            />
          </div>
        )}
        {tab === "notebooks" && vistaNotebooks === "unidades" && (
          <>
            {notebooksFiltrados.some((n) => seleccion.has(n.id)) && (
              <CopiarSeleccion
                textos={() =>
                  notebooksFiltrados
                    .filter((n) => seleccion.has(n.id))
                    .map(copyNotebook)
                }
                onLimpiar={() => setSeleccion(new Set())}
              />
            )}
            <div className="space-y-2 md:hidden">
              {notebooksFiltrados.map((n) => (
                <Card
                  key={n.id}
                  onClick={() => setOpenNotebookId(n.id)}
                  className="cursor-pointer overflow-hidden p-0"
                >
                  <div className="flex items-center gap-2.5 bg-table-header px-4 py-2 text-white">
                    <CheckSeleccion
                      tono="oscuro"
                      label={`Seleccionar ${n.modelo}`}
                      checked={seleccion.has(n.id)}
                      onChange={() => toggleSel(n.id)}
                    />
                    <p className="truncate text-sm font-semibold">{n.modelo}</p>
                  </div>
                  <div className="flex items-stretch gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-neutral-500">
                        {[n.cpu, n.memoria, n.almacenamiento]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {n.numeroSerie || "Sin número de serie"}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {condicionLabel(n)}
                        {n.condicion === "usado" && n.bateria !== null
                          ? ` · Batería ${n.bateria}%`
                          : ""}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 text-[11px] text-neutral-400">
                        {puedeVerCosto && (
                          <span>Costo {fmtUsd(n.costoUsd)}</span>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              dotClass[celularStatus[n.estado].tone],
                            )}
                          />
                          {celularStatus[n.estado].label}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-neutral-100 pl-3">
                      <p className="text-base font-semibold tabular-nums">
                        {fmtUsd(n.precioUsd)}
                      </p>
                      <CopiarTexto texto={copyNotebook(n)} />
                    </div>
                  </div>
                </Card>
              ))}
              {notebooksFiltrados.length === 0 && (
                <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
                  Sin notebooks para esta búsqueda.
                </p>
              )}
            </div>
            <Card className="hidden overflow-hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-xs">
                    <th className="w-px py-3 pl-4 pr-0 text-center">
                      <CheckSeleccion
                        label="Seleccionar todas las notebooks"
                        tono="oscuro"
                        parcial={notebooksFiltrados.some((n) =>
                          seleccion.has(n.id),
                        )}
                        checked={
                          notebooksFiltrados.length > 0 &&
                          notebooksFiltrados.every((n) => seleccion.has(n.id))
                        }
                        onChange={() =>
                          toggleTodos(notebooksFiltrados.map((n) => n.id))
                        }
                      />
                    </th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      Modelo
                    </th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      CPU
                    </th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      Memoria
                    </th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      Almacenamiento
                    </th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      Placa de video
                    </th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      Pantalla
                    </th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      Condición
                    </th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      Estado
                    </th>
                    {puedeVerCosto && (
                      <th className={cn("px-5 py-3 text-center", thDivider)}>
                        Costo
                      </th>
                    )}
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      Precio
                    </th>
                    <th className="w-px px-3 py-3 text-center">
                      <span className="sr-only">
                        Copiar texto para publicar
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {notebooksFiltrados.map((n) => (
                    <tr
                      key={n.id}
                      onClick={() => setOpenNotebookId(n.id)}
                      className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                    >
                      <td
                        className="w-px py-2 pl-4 pr-0"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <CheckSeleccion
                          label={`Seleccionar ${n.modelo}`}
                          checked={seleccion.has(n.id)}
                          onChange={() => toggleSel(n.id)}
                        />
                      </td>
                      <td className="max-w-[220px] px-5 py-2 text-start">
                        <p className="truncate font-medium">{n.modelo}</p>
                        <p className="truncate text-xs text-neutral-500">
                          {n.numeroSerie || "Sin número de serie"}
                        </p>
                      </td>
                      <td className="px-5 py-2 text-center text-neutral-500">
                        {n.cpu || "—"}
                      </td>
                      <td className="px-5 py-2 text-center text-neutral-500">
                        {n.memoria || "—"}
                      </td>
                      <td className="px-5 py-2 text-center text-neutral-500">
                        {n.almacenamiento || "—"}
                      </td>
                      <td className="px-5 py-2 text-center text-neutral-500">
                        {n.gpu || "—"}
                      </td>
                      <td className="px-5 py-2 text-center text-neutral-500">
                        {n.pantalla || "—"}
                      </td>
                      <td className="px-5 py-2 text-center">
                        <p className="text-neutral-700">{condicionLabel(n)}</p>
                        {n.condicion === "usado" && n.bateria !== null && (
                          <p className="text-xs tabular-nums text-neutral-500">
                            Batería {n.bateria}%
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-2 text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              dotClass[celularStatus[n.estado].tone],
                            )}
                          />
                          {celularStatus[n.estado].label}
                        </span>
                      </td>
                      {puedeVerCosto && (
                        <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                          {fmtUsd(n.costoUsd)}
                        </td>
                      )}
                      <td className="px-5 py-2 text-center font-semibold tabular-nums">
                        {fmtUsd(n.precioUsd)}
                      </td>
                      <td className="w-px whitespace-nowrap px-3 py-2 text-center">
                        <CopiarTexto texto={copyNotebook(n)} />
                      </td>
                    </tr>
                  ))}
                  {notebooksFiltrados.length === 0 && (
                    <tr>
                      <td
                        colSpan={puedeVerCosto ? 12 : 11}
                        className="px-5 py-10 text-center text-sm text-neutral-400"
                      >
                        Sin notebooks para esta búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </>
        )}

        {/* ── Repuestos ─────────────────────────── */}
        {tab === "repuestos" &&
          (() => {
            const reponerList = repuestos
              .filter((r) => r.stock <= r.stockMin)
              .sort((a, b) => a.stock / a.stockMin - b.stock / b.stockMin);

            return (
              <>
                <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
                  <div className="space-y-2 md:hidden">
                    {repuestosFiltrados.map((r) => {
                      const est = repuestoEstado(r.stock, r.stockMin);
                      const frac = Math.max(
                        0,
                        Math.min(1, r.stock / (r.stockMin * 2)),
                      );
                      const barColor =
                        r.stock <= 0
                          ? "bg-red-500"
                          : r.stock <= r.stockMin
                            ? "bg-amber-500"
                            : "bg-emerald-500";
                      return (
                        <Card
                          key={r.id}
                          onClick={() => setOpenRepuestoId(r.id)}
                          className="cursor-pointer overflow-hidden p-0"
                        >
                          <div className="bg-table-header px-4 py-2 text-white">
                            <p className="truncate text-sm font-semibold">
                              {r.nombre}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "p-3",
                              r.stock <= 0 && "bg-red-50/50",
                              r.stock > 0 &&
                                r.stock <= r.stockMin &&
                                "bg-amber-50/40",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs text-neutral-400">
                                {r.sku} · {r.modelo}
                              </p>
                              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    dotClass[est.tone],
                                  )}
                                />
                                {est.label}
                              </span>
                            </div>

                            <div className="mt-2.5 flex items-center gap-2 border-t border-neutral-100 pt-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs tabular-nums text-neutral-500">
                                  <span className="font-semibold text-neutral-900">
                                    {r.stock}
                                  </span>{" "}
                                  / mín {r.stockMin}
                                  {puedeVerCosto && ` · ${fmtUsd(r.costoUsd)}`}
                                </p>
                                <div
                                  className="mt-1 h-1.5 overflow-hidden rounded-full"
                                  style={{ background: GHOST_STRIPES }}
                                >
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      barColor,
                                    )}
                                    style={{ width: `${frac * 100}%` }}
                                  />
                                </div>
                              </div>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reponer(r.id);
                                }}
                                variant="tonal"
                                size="sm"
                              >
                                Reponer
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                    {repuestosFiltrados.length === 0 && (
                      <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
                        Sin repuestos para esta búsqueda.
                      </p>
                    )}
                  </div>
                  <Card className="hidden overflow-hidden md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                          <th
                            className={cn("px-5 py-3 text-center", thDivider)}
                          >
                            Repuesto
                          </th>
                          <th
                            className={cn("px-5 py-3 text-center", thDivider)}
                          >
                            Modelo
                          </th>
                          <th
                            className={cn("px-5 py-3 text-center", thDivider)}
                          >
                            Stock
                          </th>
                          {puedeVerCosto && (
                            <th
                              className={cn("px-5 py-3 text-center", thDivider)}
                            >
                              Costo
                            </th>
                          )}
                          <th
                            className={cn("px-5 py-3 text-center", thDivider)}
                          >
                            Estado
                          </th>
                          <th className="px-5 py-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repuestosFiltrados.map((r) => {
                          const est = repuestoEstado(r.stock, r.stockMin);
                          const frac = Math.max(
                            0,
                            Math.min(1, r.stock / (r.stockMin * 2)),
                          );
                          const barColor =
                            r.stock <= 0
                              ? "bg-red-500"
                              : r.stock <= r.stockMin
                                ? "bg-amber-500"
                                : "bg-emerald-500";
                          return (
                            <tr
                              key={r.id}
                              onClick={() => setOpenRepuestoId(r.id)}
                              className={cn(
                                "cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50",
                                r.stock <= 0 && "bg-red-50/50",
                                r.stock > 0 &&
                                  r.stock <= r.stockMin &&
                                  "bg-amber-50/40",
                              )}
                            >
                              <td className="max-w-[160px] truncate px-5 py-2 text-start">
                                <span className="font-medium">{r.nombre}</span>
                                <span className="block truncate text-xs text-neutral-400">
                                  {r.sku}
                                </span>
                              </td>
                              <td className="max-w-[120px] truncate px-5 py-2 text-start text-neutral-500">
                                {r.modelo}
                              </td>
                              <td className="px-5 py-2 text-center">
                                <div className="mx-auto w-24">
                                  <p className="tabular-nums">
                                    <span className="font-semibold">
                                      {r.stock}
                                    </span>
                                    <span className="text-xs text-neutral-400">
                                      {" "}
                                      / mín {r.stockMin}
                                    </span>
                                  </p>
                                  <div
                                    className="mt-1 h-1.5 overflow-hidden rounded-full"
                                    style={{ background: GHOST_STRIPES }}
                                  >
                                    <div
                                      className={cn(
                                        "h-full rounded-full",
                                        barColor,
                                      )}
                                      style={{ width: `${frac * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              {puedeVerCosto && (
                                <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                                  {fmtUsd(r.costoUsd)}
                                </td>
                              )}
                              <td className="px-5 py-2 text-center">
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full",
                                      dotClass[est.tone],
                                    )}
                                  />
                                  {est.label}
                                </span>
                              </td>
                              <td className="px-5 py-2 text-center">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    reponer(r.id);
                                  }}
                                  variant="tonal"
                                  size="sm"
                                >
                                  Reponer
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                        {repuestosFiltrados.length === 0 && (
                          <tr>
                            <td
                              colSpan={puedeVerCosto ? 6 : 5}
                              className="px-5 py-10 text-center text-sm text-neutral-400"
                            >
                              Sin repuestos para esta búsqueda.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Card>

                  <Card className="p-5">
                    <div className="flex items-baseline justify-between border-b border-neutral-100 pb-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                        Reponer pronto
                      </p>
                      <span className="text-xs text-neutral-400">
                        {reponerList.length} bajo el mínimo
                      </span>
                    </div>
                    {reponerList.length === 0 ? (
                      <p className="mt-4 text-sm text-neutral-400">
                        Todo por encima del mínimo.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {reponerList.map((r) => {
                          const pct = Math.round((r.stock / r.stockMin) * 100);
                          return (
                            <li
                              key={r.id}
                              className="border-b border-neutral-100 pb-3 last:border-b-0 last:pb-0"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-medium">
                                  {r.nombre}
                                </span>
                                <Button
                                  onClick={() => reponer(r.id)}
                                  variant="primary"
                                >
                                  Reponer
                                </Button>
                              </div>
                              <p className="text-[11px] text-neutral-400">
                                {r.sku} · {r.proveedor}
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className="text-xs font-semibold tabular-nums">
                                  {r.stock} / {r.stockMin}
                                </span>
                                <div
                                  className="h-1.5 flex-1 overflow-hidden rounded-full"
                                  style={{ background: GHOST_STRIPES }}
                                >
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      r.stock <= 0
                                        ? "bg-red-500"
                                        : "bg-amber-500",
                                    )}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                                <span className="text-[11px] text-neutral-400">
                                  {pct}%
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Card>
                </div>
              </>
            );
          })()}

        {/* ── Otros ─────────────────────────────── */}
        {tab === "otros" &&
          (() => {
            return (
              <>
                <div className="space-y-2 md:hidden">
                  {otrosFiltrados.map((o) => {
                    const cantidad = otroCantidad(o);
                    const expanded = expandedOtros.has(o.id);
                    return (
                      <Card
                        key={o.id}
                        onClick={() => setOpenOtroId(o.id)}
                        className="cursor-pointer overflow-hidden p-0"
                      >
                        <div className="flex items-center justify-between gap-2 bg-table-header px-4 py-2 text-white">
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {o.nombre}
                          </p>
                          {o.serializado && (
                            <IconButton
                              aria-label="Expandir"
                              icon={ChevronDown}
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandOtro(o.id);
                              }}
                            />
                          )}
                        </div>

                        <div className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 flex-1 truncate text-xs text-neutral-500">
                              {o.descripcion ?? "—"}
                            </p>
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  dotClass[otroCategoria[o.categoria].tone],
                                )}
                              />
                              {otroCategoria[o.categoria].label}
                            </span>
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 text-[11px] text-neutral-400">
                            {puedeVerCosto && (
                              <span>
                                Costo {fmtUsd(otroCostoPromedio(o))}
                                {o.serializado && (
                                  <span className="ml-1 text-[10px]">
                                    prom.
                                  </span>
                                )}
                              </span>
                            )}
                            <span className="font-semibold text-neutral-900">
                              {fmtUsd(o.precioUsd)}
                            </span>
                            {o.serializado ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-neutral-700">
                                {cantidad}
                                <Tag className="h-3 w-3 text-neutral-400" />
                              </span>
                            ) : (
                              <span className="font-semibold text-neutral-900">
                                {cantidad}
                              </span>
                            )}
                          </div>

                          {o.serializado && expanded && (
                            <div
                              className="animate-fade-in mt-2.5 overflow-hidden rounded-lg border border-neutral-200 font-mono"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div
                                className={cn(
                                  "grid gap-2 border-b border-neutral-200 bg-neutral-100 px-3 py-1.5 text-start text-[10px] font-semibold uppercase tracking-wider text-neutral-500",
                                  puedeVerCosto
                                    ? "grid-cols-[1fr_1fr_84px]"
                                    : "grid-cols-[1fr_1fr]",
                                )}
                              >
                                <span>Serial</span>
                                <span>Color</span>
                                {puedeVerCosto && (
                                  <span className="text-end">Costo</span>
                                )}
                              </div>
                              {o.unidades.map((u) => (
                                <div
                                  key={u.serial}
                                  className={cn(
                                    "grid items-center gap-2 border-t border-neutral-100 bg-white px-3 py-1.5 text-[12px] first:border-t-0",
                                    puedeVerCosto
                                      ? "grid-cols-[1fr_1fr_84px]"
                                      : "grid-cols-[1fr_1fr]",
                                  )}
                                >
                                  <span className="truncate text-neutral-700">
                                    {u.serial}
                                  </span>
                                  <span className="truncate text-neutral-500">
                                    {u.color ?? "—"}
                                  </span>
                                  {puedeVerCosto && (
                                    <span className="text-end tabular-nums text-neutral-500">
                                      {fmtUsd(u.costoUsd)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                  {otrosFiltrados.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
                      Sin productos para esta búsqueda.
                    </p>
                  )}
                </div>
                <Card className="hidden overflow-hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Producto
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Descripción
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Categoría
                        </th>
                        {puedeVerCosto && (
                          <th
                            className={cn("px-5 py-3 text-center", thDivider)}
                          >
                            Costo
                          </th>
                        )}
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Precio
                        </th>
                        <th className="px-5 py-3 text-center">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otrosFiltrados.map((o) => {
                        const cantidad = otroCantidad(o);
                        const expanded = expandedOtros.has(o.id);
                        return (
                          <Fragment key={o.id}>
                            <tr
                              onClick={() => setOpenOtroId(o.id)}
                              className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                            >
                              <td className="max-w-[180px] truncate px-5 py-2 text-start font-medium">
                                <span className="inline-flex items-center gap-1">
                                  <span className="flex w-3.5 shrink-0 justify-center">
                                    {o.serializado && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExpandOtro(o.id);
                                        }}
                                        className="text-neutral-400 hover:text-accent"
                                      >
                                        <ChevronDown
                                          className={cn(
                                            "h-3.5 w-3.5 transition-transform",
                                            expanded && "rotate-180",
                                          )}
                                        />
                                      </button>
                                    )}
                                  </span>
                                  <span className="truncate">{o.nombre}</span>
                                </span>
                              </td>
                              <td className="max-w-[220px] truncate px-5 py-2 text-start text-neutral-500">
                                {o.descripcion ?? "—"}
                              </td>
                              <td className="px-5 py-2 text-center">
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full",
                                      dotClass[otroCategoria[o.categoria].tone],
                                    )}
                                  />
                                  {otroCategoria[o.categoria].label}
                                </span>
                              </td>
                              {puedeVerCosto && (
                                <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                                  {fmtUsd(otroCostoPromedio(o))}
                                  {o.serializado && (
                                    <span className="ml-1 text-[10px] text-neutral-400">
                                      prom.
                                    </span>
                                  )}
                                </td>
                              )}
                              <td className="px-5 py-2 text-center font-semibold tabular-nums">
                                {fmtUsd(o.precioUsd)}
                              </td>
                              <td className="px-5 py-2 text-center font-semibold tabular-nums">
                                {o.serializado ? (
                                  <span className="inline-flex items-center gap-1 text-neutral-700">
                                    {cantidad}
                                    <Tag className="h-3 w-3 text-neutral-400" />
                                  </span>
                                ) : (
                                  cantidad
                                )}
                              </td>
                            </tr>
                            {o.serializado && expanded && (
                              <tr className="bg-neutral-50">
                                <td
                                  colSpan={puedeVerCosto ? 6 : 5}
                                  className="px-5 py-3"
                                >
                                  <div className="animate-fade-in overflow-hidden rounded-lg border border-neutral-200 font-mono">
                                    <div
                                      className={cn(
                                        "grid gap-2 border-b border-neutral-200 bg-neutral-100 px-3 py-1.5 text-start text-[10px] font-semibold uppercase tracking-wider text-neutral-500",
                                        puedeVerCosto
                                          ? "grid-cols-[1fr_1fr_84px]"
                                          : "grid-cols-[1fr_1fr]",
                                      )}
                                    >
                                      <span>Serial</span>
                                      <span>Color</span>
                                      {puedeVerCosto && (
                                        <span className="text-end">Costo</span>
                                      )}
                                    </div>
                                    {o.unidades.map((u) => (
                                      <div
                                        key={u.serial}
                                        className={cn(
                                          "grid items-center gap-2 border-t border-neutral-100 bg-white px-3 py-1.5 text-[12px] first:border-t-0",
                                          puedeVerCosto
                                            ? "grid-cols-[1fr_1fr_84px]"
                                            : "grid-cols-[1fr_1fr]",
                                        )}
                                      >
                                        <span className="truncate text-neutral-700">
                                          {u.serial}
                                        </span>
                                        <span className="truncate text-neutral-500">
                                          {u.color ?? "—"}
                                        </span>
                                        {puedeVerCosto && (
                                          <span className="text-end tabular-nums text-neutral-500">
                                            {fmtUsd(u.costoUsd)}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {otrosFiltrados.length === 0 && (
                        <tr>
                          <td
                            colSpan={puedeVerCosto ? 6 : 5}
                            className="px-5 py-10 text-center text-sm text-neutral-400"
                          >
                            Sin productos para esta búsqueda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
              </>
            );
          })()}
      </SeccionTabla>

      {/* Ver / editar celular */}
      <CelularFormDialog
        key={openCelularId ?? "celular-none"}
        celular={openCelular}
        variantes={variantes}
        unidades={celulares}
        open={!!openCelular}
        onClose={() => setOpenCelularId(null)}
        onVarianteCreada={(v) => setVariantes((p) => [...p, v])}
        puedeVerCosto={puedeVerCosto}
        onSubmit={async (data) => {
          const antes = celulares;
          const actualizado = await updateCelularAction(openCelular!.id, data);
          const despues = celulares.map((x) =>
            x.id === actualizado.id ? actualizado : x,
          );
          setCelulares(despues);
          avisarStockBajo([actualizado.varianteId], antes, despues);
          setOpenCelularId(null);
        }}
        onDelete={
          esAdmin
            ? () => {
                const id = openCelular!.id;
                const modelo = openCelular!.modelo;
                const varianteId = openCelular!.varianteId;
                const antes = celulares;
                const despues = celulares.filter((x) => x.id !== id);
                setCelulares(despues);
                setOpenCelularId(null);
                avisarStockBajo([varianteId], antes, despues);
                startDeleteTransition(async () => {
                  await deleteCelularAction(id);
                });
                publish({
                  type: "item_deleted",
                  actor: user.nombre,
                  entity: "Celular",
                  label: modelo,
                });
              }
            : undefined
        }
      />

      {/* Variantes: editar / renombrar grupo / unir / eliminar */}
      {varianteEditando && (
        <VarianteDialog
          key={`variante-${varianteEditando.id}`}
          open
          variante={varianteEditando}
          grupos={Array.from(
            new Set(
              variantes
                .filter((v) => v.categoria === varianteEditando.categoria)
                .map((v) => v.grupo),
            ),
          )}
          skus={variantes.map((v) => v.sku)}
          onClose={() => setVarianteEditando(null)}
          onSaved={(v) => {
            setVariantes((p) => p.map((x) => (x.id === v.id ? v : x)));
            setVarianteEditando(null);
            router.refresh();
          }}
        />
      )}

      {grupoRenombrando !== null && (
        <RenombrarGrupoDialog
          key={`grupo-${grupoRenombrando}`}
          open
          grupo={grupoRenombrando}
          categoria={tab === "notebooks" ? "notebook" : "celular"}
          onClose={() => setGrupoRenombrando(null)}
          onSaved={() => router.refresh()}
        />
      )}

      {varianteUniendo && (
        <UnirVariantesDialog
          key={`unir-${varianteUniendo.id}`}
          open
          origen={varianteUniendo}
          variantes={variantes}
          celulares={varianteUniendo.categoria === "notebook" ? notebooks : celulares}
          onClose={() => setVarianteUniendo(null)}
          onDone={() => router.refresh()}
        />
      )}

      {varianteEliminando && (
        <ConfirmDialog
          open
          onClose={() => {
            setVarianteEliminando(null);
            setErrorEliminarVariante(null);
          }}
          onConfirm={() => {
            const variante = varianteEliminando;
            startDeleteTransition(async () => {
              const res = await deleteVarianteAction(variante.id);
              if (!res.ok) {
                setErrorEliminarVariante(res.error ?? "No se pudo eliminar la variante.");
                return;
              }
              setVariantes((p) => p.filter((x) => x.id !== variante.id));
              setVarianteEliminando(null);
              setErrorEliminarVariante(null);
              router.refresh();
            });
          }}
          title={`¿Eliminar ${varianteEliminando.sku}?`}
          confirmLabel="Eliminar variante"
        >
          <>
            Se elimina la variante. Solo es posible si no tiene ningún equipo: si tiene, desactivala.
            {errorEliminarVariante && (
              <p className="text-xs text-red-600">{errorEliminarVariante}</p>
            )}
          </>
        </ConfirmDialog>
      )}

      {/* Ver / editar notebook */}
      <NotebookFormDialog
        key={openNotebookId ?? "notebook-none"}
        notebook={openNotebook}
        variantes={variantes}
        unidades={notebooks}
        onVarianteCreada={(v) => setVariantes((p) => [...p, v])}
        open={!!openNotebook}
        onClose={() => setOpenNotebookId(null)}
        puedeVerCosto={puedeVerCosto}
        onSubmit={async (data) => {
          const res = await updateNotebookAction(openNotebook!.id, data);
          if (!res.ok) throw new Error(res.error);
          const antes = notebooks;
          const despues = notebooks.map((x) => (x.id === res.notebook.id ? res.notebook : x));
          setNotebooks(despues);
          avisarStockBajo([res.notebook.varianteId], antes, despues);
          setOpenNotebookId(null);
        }}
        onDelete={
          esAdmin
            ? () => {
                const id = openNotebook!.id;
                const modelo = openNotebook!.modelo;
                const varianteId = openNotebook!.varianteId;
                const antes = notebooks;
                const despues = notebooks.filter((x) => x.id !== id);
                setNotebooks(despues);
                setOpenNotebookId(null);
                avisarStockBajo([varianteId], antes, despues);
                startDeleteTransition(async () => {
                  await deleteNotebookAction(id);
                });
                publish({
                  type: "item_deleted",
                  actor: user.nombre,
                  entity: "Notebook",
                  label: modelo,
                });
              }
            : undefined
        }
      />


      {/* Ver / editar repuesto */}
      <RepuestoFormDialog
        key={openRepuestoId ?? "repuesto-none"}
        repuesto={openRepuesto}
        open={!!openRepuesto}
        puedeVerCosto={puedeVerCosto}
        onClose={() => setOpenRepuestoId(null)}
        onSubmit={async (data) => {
          const actualizado = await updateRepuestoAction(
            openRepuesto!.id,
            data,
          );
          setRepuestos((p) =>
            p.map((x) => (x.id === actualizado.id ? actualizado : x)),
          );
          setOpenRepuestoId(null);
        }}
        onDelete={
          esAdmin
            ? () => {
                const id = openRepuesto!.id;
                const nombre = openRepuesto!.nombre;
                setRepuestos((p) => p.filter((x) => x.id !== id));
                setOpenRepuestoId(null);
                startDeleteTransition(async () => {
                  await deleteRepuestoAction(id);
                });
                publish({
                  type: "item_deleted",
                  actor: user.nombre,
                  entity: "Repuesto",
                  label: nombre,
                });
              }
            : undefined
        }
      />

      {/* Ver / editar producto de "Otros" */}
      <OtroFormDialog
        key={openOtroId ?? "otro-none"}
        item={openOtro}
        open={!!openOtro}
        onClose={() => setOpenOtroId(null)}
        puedeVerCosto={puedeVerCosto}
        onSubmit={async (o) => {
          const actualizado = await updateOtroAction(o.id, o);
          setOtros((p) =>
            p.map((x) => (x.id === actualizado.id ? actualizado : x)),
          );
          setOpenOtroId(null);
        }}
        onDelete={
          esAdmin
            ? () => {
                const id = openOtro!.id;
                const nombre = openOtro!.nombre;
                setOtros((p) => p.filter((x) => x.id !== id));
                setOpenOtroId(null);
                startDeleteTransition(async () => {
                  await deleteOtroAction(id);
                });
                publish({
                  type: "item_deleted",
                  actor: user.nombre,
                  entity: "Producto",
                  label: nombre,
                });
              }
            : undefined
        }
      />

      {/* Recuento -- siempre en un modal aparte, la tabla no cambia de forma */}
      <RecuentoCelularesModalDialog
        key={
          recuentoModalTipo === "celulares"
            ? "celulares"
            : "recuento-celulares-none"
        }
        open={recuentoModalTipo === "celulares"}
        items={celulares
          .filter((e) => e.estado !== "vendido")
          .map((e) => ({
            id: e.id,
            nombre: `${e.modelo} ${e.almacenamiento} · ${e.color} · ${e.imei}`,
          }))}
        onClose={() => setRecuentoModalTipo(null)}
        onSubmit={async (draft, comentarios, comentarioGeneral) => {
          await crearRecuentoCelularesAction(
            draft,
            comentarios,
            comentarioGeneral,
          );
          setRecuentoModalTipo(null);
        }}
      />
      <RecuentoModalDialog
        key={
          recuentoModalTipo === "repuestos" || recuentoModalTipo === "otros"
            ? recuentoModalTipo
            : "recuento-modal-none"
        }
        tipo={recuentoModalTipo === "otros" ? "otros" : "repuestos"}
        open={
          recuentoModalTipo === "repuestos" || recuentoModalTipo === "otros"
        }
        items={
          recuentoModalTipo === "repuestos"
            ? repuestos.map((r) => ({
                id: r.id,
                nombre: r.nombre,
                sistema: r.stock,
              }))
            : otros.flatMap((o) =>
                o.serializado
                  ? []
                  : [{ id: o.id, nombre: o.nombre, sistema: o.cantidad }],
              )
        }
        onClose={() => setRecuentoModalTipo(null)}
        onSubmit={async (draft, comentarios, comentarioGeneral) => {
          if (recuentoModalTipo === "repuestos") {
            await crearRecuentoRepuestosAction(
              draft,
              comentarios,
              comentarioGeneral,
            );
          } else {
            await crearRecuentoOtrosAction(
              draft,
              comentarios,
              comentarioGeneral,
            );
          }
          setRecuentoModalTipo(null);
        }}
      />
    </>
  );
}

// ─────────────────────────── Dialogs ───────────────────────────

type RecuentoModalItem = { id: string; nombre: string; sistema: number };

const RECUENTO_MODAL_TITULO: Record<"repuestos" | "otros", string> = {
  repuestos: "Recuento de repuestos",
  otros: "Recuento de otros productos",
};

/** Modal de recuento para Repuestos/Otros (ver `RecuentoCelularesModalDialog`
 * más abajo para Celulares, que es un checklist en vez de cantidades). Una
 * fila por ítem: Sistema (de referencia, no editable) + Cantidad real +
 * comentario opcional, más un comentario general de todo el recuento al
 * pie. La tabla de Inventario no cambia de forma al abrir esto -- antes el
 * modo inline mutaba las filas de la tabla en el lugar, que era justamente
 * la parte confusa. Un ítem que se deja en blanco en "Cantidad real" no
 * entra en el recuento, mismo criterio que tenía el modo inline viejo. */
function RecuentoModalDialog({
  tipo,
  items,
  open,
  onClose,
  onSubmit,
}: {
  tipo: "repuestos" | "otros";
  items: RecuentoModalItem[];
  open: boolean;
  onClose: () => void;
  onSubmit: (
    draft: Record<string, number>,
    comentarios: Record<string, string>,
    comentarioGeneral: string | undefined,
  ) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [contados, setContados] = useState<Record<string, string>>({});
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [comentarioGeneral, setComentarioGeneral] = useState("");
  const [pending, startTransition] = useTransition();

  const needle = q.trim().toLowerCase();
  const filtrados = items.filter(
    (i) => !needle || i.nombre.toLowerCase().includes(needle),
  );
  const contadosCount = Object.values(contados).filter(
    (v) => v.trim() !== "",
  ).length;

  function guardar() {
    startTransition(async () => {
      const draft: Record<string, number> = {};
      const coms: Record<string, string> = {};
      for (const [id, raw] of Object.entries(contados)) {
        if (raw.trim() === "") continue;
        draft[id] = Number(raw) || 0;
        const c = comentarios[id]?.trim();
        if (c) coms[id] = c;
      }
      await onSubmit(draft, coms, comentarioGeneral.trim() || undefined);
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      title={RECUENTO_MODAL_TITULO[tipo]}
      description={`Anotá la cantidad real al lado de cada producto — lo que dejes en blanco no entra en el recuento. El stock no se ajusta solo, queda pendiente de revisión en «Recuentos».`}
      footer={
        <>
          <Button
            onClick={onClose}
            disabled={pending}
            variant="outline"
            fullOnMobile
          >
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={pending || contadosCount === 0}
            variant="primary"
            fullOnMobile
          >
            {pending ? "Guardando…" : "Guardar recuento"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto…"
            className={cn("w-full pl-9", filterPill)}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2 text-center">Sistema</th>
                <th className="px-3 py-2 text-center">Cantidad real</th>
                <th className="px-3 py-2">Comentario</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-1.5 font-medium text-start">{item.nombre}</td>
                  <td className="px-3 py-1.5 text-center tabular-nums text-neutral-500">
                    {item.sistema}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <Input
                      type="number"
                      min={0}
                      placeholder="Contado"
                      value={contados[item.id] ?? ""}
                      onChange={(e) =>
                        setContados((c) => ({
                          ...c,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="mx-auto h-8 w-20 text-center"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-start">
                    <Input
                      value={comentarios[item.id] ?? ""}
                      onChange={(e) =>
                        setComentarios((c) => ({
                          ...c,
                          [item.id]: e.target.value,
                        }))
                      }
                      placeholder="Opcional"
                      className="h-8 text-sm"
                    />
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-neutral-400"
                  >
                    Sin productos para esta búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Field label="Comentario general (opcional)">
          <Textarea
            value={comentarioGeneral}
            onChange={(e) => setComentarioGeneral(e.target.value)}
            placeholder="Notas generales de este recuento…"
            rows={2}
          />
        </Field>
      </div>
    </Dialog>
  );
}

type RecuentoCelularItem = { id: string; nombre: string };

/** Modal de recuento para Celulares -- un checklist "Encontrado" en vez de
 * cantidades (ver `RecuentoModalDialog` arriba para Repuestos/Otros). Todos
 * arrancan tildados como encontrados; destildar uno abre un comentario
 * opcional para esa fila, igual criterio que tenía el modo inline viejo
 * (comentario libre solo tiene sentido para lo que no se encontró). No
 * ajusta `celulares.estado` al guardar -- queda pendiente hasta que un admin
 * lo revise en «Recuentos» (`resolverRecuento`). */
function RecuentoCelularesModalDialog({
  items,
  open,
  onClose,
  onSubmit,
}: {
  items: RecuentoCelularItem[];
  open: boolean;
  onClose: () => void;
  onSubmit: (
    draft: Record<string, boolean>,
    comentarios: Record<string, string>,
    comentarioGeneral: string | undefined,
  ) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [encontrados, setEncontrados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.id, true])),
  );
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [comentarioGeneral, setComentarioGeneral] = useState("");
  const [pending, startTransition] = useTransition();

  const needle = q.trim().toLowerCase();
  const filtrados = items.filter(
    (i) => !needle || i.nombre.toLowerCase().includes(needle),
  );

  function guardar() {
    startTransition(async () => {
      await onSubmit(
        encontrados,
        comentarios,
        comentarioGeneral.trim() || undefined,
      );
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      title="Recuento de celulares"
      description="Tildá los celulares que encontraste físicamente -- las diferencias quedan pendientes de revisión en «Recuentos», no se marcan extraviados al toque. Los celulares vendidos no entran en el recuento."
      footer={
        <>
          <Button
            onClick={onClose}
            disabled={pending}
            variant="outline"
            fullOnMobile
          >
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={pending}
            variant="primary"
            fullOnMobile
          >
            {pending ? "Guardando…" : "Guardar recuento"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por modelo, color o IMEI…"
            className={cn("w-full pl-9", filterPill)}
          />
        </div>

        <div className="space-y-2">
          {filtrados.map((item) => {
            const found = encontrados[item.id] ?? true;
            return (
              <Card key={item.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
                    {item.nombre}
                  </p>
                  <label className="flex shrink-0 items-center gap-2 text-[11px] font-medium text-neutral-500">
                    Encontrado
                    <input
                      type="checkbox"
                      checked={found}
                      onChange={(e) =>
                        setEncontrados((d) => ({
                          ...d,
                          [item.id]: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded border-neutral-300 text-accent focus:ring-accent"
                    />
                  </label>
                </div>
                {!found && (
                  <Input
                    value={comentarios[item.id] ?? ""}
                    onChange={(e) =>
                      setComentarios((c) => ({
                        ...c,
                        [item.id]: e.target.value,
                      }))
                    }
                    placeholder="¿Qué pasó con este celular? (opcional)"
                    className="mt-2 text-sm"
                  />
                )}
              </Card>
            );
          })}
          {filtrados.length === 0 && (
            <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
              No hay celulares para auditar con esta búsqueda.
            </p>
          )}
        </div>

        <Field label="Comentario general (opcional)">
          <Textarea
            value={comentarioGeneral}
            onChange={(e) => setComentarioGeneral(e.target.value)}
            placeholder="Notas generales de este recuento…"
            rows={2}
          />
        </Field>
      </div>
    </Dialog>
  );
}

const ESTADOS: CelularStatus[] = [
  "en_revision",
  "disponible",
  "reservado",
  "vendido",
  "extraviado",
];

export function CelularFormDialog({
  celular,
  variantes,
  unidades = [],
  varianteInicialId,
  open,
  onClose,
  onSubmit,
  onDelete,
  onVarianteCreada,
  puedeVerCosto,
  modoCompra = false,
}: {
  celular: Celular | null;
  variantes: Variante[];
  /** Para mostrar stock disponible en el selector (opcional). */
  unidades?: Celular[];
  /** Alta desde una variante puntual (menú «Agregar unidad»). */
  varianteInicialId?: string | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (e: CelularInput) => void | Promise<void>;
  onDelete?: () => void;
  onVarianteCreada?: (variante: Variante) => void;
  /** false para vendedor -- oculta el costo de un celular YA cargado (no el
   * campo al dar de alta uno nuevo, ahí lo escribe la misma persona). */
  puedeVerCosto: boolean;
  /** Plan 025: el formulario se usa para armar el carrito de una compra.
   * `onSubmit` solo agrega el ítem (no guarda) y el dialog se cierra, sin el
   * paso de «Confirmar ingreso al stock». */
  modoCompra?: boolean;
}) {
  const edit = !!celular;
  const [f, setF] = useState<Celular>(
    celular ?? {
      id: "",
      modelo: "",
      almacenamiento: "128GB",
      color: "",
      imei: "",
      bateria: 100,
      condicion: "A",
      costoUsd: 0,
      precioUsd: 0,
      estado: "en_revision",
      varianteId: varianteInicialId ?? "",
      precioPropio: false,
    },
  );
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmAlta, setConfirmAlta] = useState(false);
  const [altaOk, setAltaOk] = useState(false);
  const set = <K extends keyof Celular>(k: K, v: Celular[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const variante = variantes.find((v) => v.id === f.varianteId) ?? null;
  // El precio efectivo: el de la variante salvo que la unidad tenga el propio.
  const precioEfectivo = variante && !f.precioPropio ? variante.precioUsd : f.precioUsd;
  const valid = !!variante && f.costoUsd > 0 && precioEfectivo > 0;
  const margen =
    precioEfectivo > 0 ? ((precioEfectivo - f.costoUsd) / precioEfectivo) * 100 : 0;

  /** Los datos clave (y el precio si no es propio) salen de la variante. */
  function elegirVariante(v: Variante | null) {
    setF((p) => ({
      ...p,
      varianteId: v?.id ?? "",
      modelo: v?.modelo ?? p.modelo,
      almacenamiento: v?.almacenamiento || p.almacenamiento,
      condicion: v?.condicion || p.condicion,
      color: v?.color || p.color,
      precioUsd: v && !p.precioPropio ? v.precioUsd : p.precioUsd,
    }));
  }

  const movimientos = useMovimientos("celular", edit ? celular!.id : null);

  function guardar() {
    startTransition(async () => {
      try {
        await onSubmit({
          varianteId: f.varianteId,
          modelo: f.modelo.trim(),
          almacenamiento: f.almacenamiento,
          color: f.color.trim() || "—",
          imei: f.imei.trim() || "—",
          bateria: bateriaCelular(variante?.condicion || f.condicion, f.bateria),
          condicion: f.condicion,
          costoUsd: f.costoUsd,
          precioUsd: precioEfectivo,
          estado: f.estado,
          precioPropio: f.precioPropio,
        });
        if (modoCompra) onClose();
        else if (!edit) setAltaOk(true);
      } catch (e) {
        setConfirmAlta(false);
        throw e;
      }
    });
  }

  return (
    <Fragment>
      <Dialog
        open={open}
        onClose={onClose}
        size="3xl"
        formulario={!edit}
        title={edit ? `Celular · ${celular!.modelo}` : modoCompra ? "Agregar celular a la compra" : "Agregar celular"}
        description={
          edit
            ? puedeVerCosto
              ? `Margen ${margen.toFixed(0)}%`
              : undefined
            : modoCompra
              ? "Entra al stock «En revisión» al guardar la compra. El costo es el unitario, antes de los costos adicionales."
              : "Ingresa en estado «En revisión»."
        }
        footer={
          <>
            {onDelete && (
              <Button
                icon={Trash2}
                onClick={() => setConfirmDelete(true)}
                variant="danger-outline"
                fullOnMobile
                className="sm:mr-auto"
              >
                Eliminar celular
              </Button>
            )}
            {celular && (
              <CopiarTexto texto={copyCelular(celular)} conTexto fullOnMobile />
            )}
            <Button onClick={onClose} variant="outline" fullOnMobile>
              Cancelar
            </Button>
            <Button
              disabled={!valid || pending}
              onClick={() => (edit || modoCompra ? guardar() : setConfirmAlta(true))}
              variant="primary"
              fullOnMobile
            >
              {pending ? "Guardando…" : edit ? "Guardar" : modoCompra ? "Agregar a la compra" : "Agregar"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Variante
            </p>
            <SelectorVariante
              variantes={variantes}
              unidades={unidades}
              value={f.varianteId || null}
              onChange={elegirVariante}
              onVarianteCreada={onVarianteCreada}
            />
            <p className="mt-1.5 text-[11px] text-neutral-500">
              {variante
                ? `Definido por la variante ${variante.sku}: el modelo, almacenamiento, condición y (si aplica) el color salen de acá.`
                : "Obligatoria: elegí una variante o creá una nueva."}
            </p>
          </div>

          <div>
            <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Información general
            </p>
            <GrillaCampos>
              <Field label="Modelo">
                <Input
                  value={variante?.modelo ?? f.modelo}
                  disabled={!!variante}
                  placeholder="iPhone 13"
                />
              </Field>
              <Field label="Almacenamiento">
                <Select
                  value={variante?.almacenamiento || f.almacenamiento}
                  disabled={!!variante}
                >
                  {Array.from(
                    new Set(
                      ["64GB", "128GB", "256GB", "512GB", "1TB"].concat(
                        variante?.almacenamiento ? [variante.almacenamiento] : [],
                      ),
                    ),
                  ).map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Color">
                <Input
                  value={variante?.color || f.color}
                  disabled={!!variante?.color}
                  onChange={(e) => set("color", e.target.value)}
                />
              </Field>
              <Field label="IMEI/Serial">
                <Input
                  value={f.imei}
                  onChange={(e) => set("imei", e.target.value)}
                />
              </Field>
              <Field label="Batería (%)">
                {esCelularNuevo(variante?.condicion || f.condicion) ? (
                  <Input value="" placeholder="No aplica (nuevo)" disabled aria-label="Batería: no aplica en un celular nuevo" />
                ) : (
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={f.bateria}
                    onChange={(e) => set("bateria", Number(e.target.value) || 0)}
                  />
                )}
              </Field>
              <Field label="Condición">
                <Select
                  value={variante?.condicion || f.condicion}
                  disabled={!!variante}
                >
                  {CONDICIONES_CELULAR.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              {(!edit || puedeVerCosto) && (
                <Field label="Costo (U$)">
                  <Input
                    type="number"
                    min={0}
                    value={f.costoUsd || ""}
                    onChange={(e) =>
                      set("costoUsd", Number(e.target.value) || 0)
                    }
                  />
                </Field>
              )}
              <Field label="Venta (U$)">
                <Input
                  type="number"
                  min={0}
                  disabled={!!variante && !f.precioPropio}
                  value={precioEfectivo || ""}
                  onChange={(e) =>
                    set("precioUsd", Number(e.target.value) || 0)
                  }
                />
              </Field>
              {edit && (
                <Field label="Estado">
                  <Select
                    value={f.estado}
                    onChange={(e) =>
                      set("estado", e.target.value as CelularStatus)
                    }
                  >
                    {ESTADOS.map((s) => (
                      <option key={s} value={s}>
                        {celularStatus[s].label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </GrillaCampos>
            {variante && (
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-[13px] text-neutral-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  checked={f.precioPropio}
                  onChange={(e) => {
                    const propio = e.target.checked;
                    setF((p) => ({
                      ...p,
                      precioPropio: propio,
                      precioUsd: propio
                        ? p.precioUsd || variante.precioUsd
                        : variante.precioUsd,
                    }));
                  }}
                />
                Precio propio para este equipo
                <span className="text-[11px] text-neutral-500">
                  (si no, sigue al de la variante)
                </span>
              </label>
            )}
          </div>

          {edit && <MovimientosLog movimientos={movimientos} />}
        </div>
      </Dialog>
      {!edit && !modoCompra && (
        <ConfirmarAltaDialog
          open={confirmAlta}
          onClose={() => setConfirmAlta(false)}
          onConfirm={guardar}
          pending={pending}
          exito={altaOk}
          onExitoTerminado={onClose}
          title="Confirmar ingreso al stock"
          pregunta="¿Agregar este celular al inventario? Ingresa en estado «En revisión»."
          confirmLabel="Agregar al stock"
          filas={[
            { label: "Variante", value: variante?.sku ?? "—" },
            { label: "Modelo", value: `${variante?.modelo ?? f.modelo} ${variante?.almacenamiento ?? f.almacenamiento}`.trim() },
            { label: "Color", value: variante?.color || f.color.trim() || "—" },
            { label: "IMEI", value: f.imei.trim() || "—" },
            { label: "Costo", value: fmtUsd(f.costoUsd) },
            { label: "Precio", value: fmtUsd(variante && !f.precioPropio ? variante.precioUsd : f.precioUsd) },
          ]}
        />
      )}
      {onDelete && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete();
          }}
          title="¿Eliminar celular?"
          confirmLabel="Eliminar celular"
        >
          Se eliminará «{celular?.modelo}» del inventario. Esta acción no se
          puede deshacer.
        </ConfirmDialog>
      )}
    </Fragment>
  );
}

function condicionLabel(n: Pick<Notebook, "condicion">): string {
  return n.condicion === "usado" ? "Usada" : "Nueva";
}

export function NotebookFormDialog({
  notebook,
  variantes,
  unidades,
  varianteInicialId,
  onVarianteCreada,
  open,
  onClose,
  onSubmit,
  onDelete,
  puedeVerCosto,
  modoCompra = false,
}: {
  notebook: Notebook | null;
  /** Todas las variantes (el selector se queda con las de notebooks). */
  variantes: Variante[];
  unidades: Notebook[];
  /** Alta desde una variante puntual (menú «Agregar unidad»). */
  varianteInicialId?: string | null;
  onVarianteCreada?: (variante: Variante) => void;
  open: boolean;
  onClose: () => void;
  onSubmit: (n: NotebookInput) => void | Promise<void>;
  onDelete?: () => void;
  puedeVerCosto: boolean;
  /** Plan 025: el formulario se usa para armar el carrito de una compra.
   * `onSubmit` solo agrega el ítem (no guarda) y el dialog se cierra, sin el
   * paso de «Confirmar ingreso al stock». */
  modoCompra?: boolean;
}) {
  const edit = !!notebook;
  const [f, setF] = useState<Notebook>(
    notebook ?? {
      id: "",
      modelo: "",
      cpu: "",
      memoria: "",
      almacenamiento: "",
      pantalla: "",
      gpu: "",
      color: "",
      idioma: "",
      numeroSerie: "",
      garantia: "",
      notas: "",
      costoUsd: 0,
      precioUsd: 0,
      estado: "en_revision",
      condicion: "nuevo",
      bateria: null,
      varianteId: varianteInicialId ?? "",
      precioPropio: false,
    },
  );
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [confirmAlta, setConfirmAlta] = useState(false);
  const [altaOk, setAltaOk] = useState(false);
  const set = <K extends keyof Notebook>(k: K, v: Notebook[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const variante = variantes.find((v) => v.id === f.varianteId) ?? null;
  // Modelo, memoria, almacenamiento y condición salen de la variante; el
  // precio también, salvo que la unidad tenga el propio.
  const condicion: NotebookCondicion = variante
    ? variante.condicion === "nuevo"
      ? "nuevo"
      : "usado"
    : f.condicion;
  const precioEfectivo = variante && !f.precioPropio ? variante.precioUsd : f.precioUsd;
  const usado = condicion === "usado";
  const bateriaOk =
    !usado || (f.bateria !== null && f.bateria >= 0 && f.bateria <= 100);
  const valid = !!variante && bateriaOk;
  const margen =
    precioEfectivo > 0 ? ((precioEfectivo - f.costoUsd) / precioEfectivo) * 100 : 0;

  function elegirVariante(v: Variante | null) {
    setF((p) => ({
      ...p,
      varianteId: v?.id ?? "",
      modelo: v?.modelo ?? p.modelo,
      memoria: v?.memoria ?? p.memoria,
      almacenamiento: v?.almacenamiento ?? p.almacenamiento,
      precioUsd: v && !p.precioPropio ? v.precioUsd : p.precioUsd,
    }));
  }

  const movimientos = useMovimientos("notebook", edit ? notebook!.id : null);

  function submit() {
    if (!valid || pending) return;
    setError("");
    startTransition(async () => {
      try {
        await onSubmit({
          varianteId: variante?.id ?? "",
          precioPropio: f.precioPropio,
          modelo: variante?.modelo ?? f.modelo.trim(),
          cpu: f.cpu,
          memoria: variante?.memoria ?? f.memoria,
          almacenamiento: variante?.almacenamiento ?? f.almacenamiento,
          pantalla: f.pantalla,
          gpu: f.gpu,
          color: f.color,
          idioma: f.idioma,
          numeroSerie: f.numeroSerie,
          garantia: f.garantia,
          notas: f.notas,
          costoUsd: f.costoUsd,
          precioUsd: precioEfectivo,
          estado: f.estado,
          condicion,
          bateria: usado ? f.bateria : null,
        });
        if (modoCompra) onClose();
        else if (!edit) setAltaOk(true);
      } catch (e) {
        setConfirmAlta(false);
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <Fragment>
      <Dialog
        open={open}
        onClose={onClose}
        size="3xl"
        formulario={!edit}
        title={edit ? `Notebook · ${notebook!.modelo}` : modoCompra ? "Agregar notebook a la compra" : "Agregar notebook"}
        description={
          edit
            ? puedeVerCosto
              ? `Margen ${margen.toFixed(0)}%`
              : undefined
            : modoCompra
              ? "Entra al stock «En revisión» al guardar la compra. El costo es el unitario, antes de los costos adicionales."
              : "Ingresa en estado «En revisión»."
        }
        footer={
          <>
            {onDelete && (
              <Button
                icon={Trash2}
                onClick={() => setConfirmDelete(true)}
                variant="danger-outline"
                fullOnMobile
                className="sm:mr-auto"
              >
                Eliminar notebook
              </Button>
            )}
            {notebook && (
              <CopiarTexto
                texto={copyNotebook(notebook)}
                conTexto
                fullOnMobile
              />
            )}
            <Button onClick={onClose} variant="outline" fullOnMobile>
              Cancelar
            </Button>
            <Button
              onClick={() => (edit || modoCompra ? submit() : setConfirmAlta(true))}
              loading={pending}
              disabled={!valid}
              fullOnMobile
            >
              {edit ? "Guardar cambios" : modoCompra ? "Agregar a la compra" : "Agregar notebook"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Variante
            </p>
            <SelectorVariante
              categoria="notebook"
              variantes={variantes}
              unidades={unidades}
              value={variante?.id ?? null}
              onChange={elegirVariante}
              onVarianteCreada={onVarianteCreada}
            />
            <p className="mt-1.5 text-[11px] text-neutral-500">
              {variante
                ? `Definido por la variante ${variante.sku}: el modelo, la memoria, el almacenamiento y la condición salen de acá.`
                : "Obligatoria: elegí una variante o creá una nueva."}
            </p>
          </div>
          <GrillaCampos>
            <Field label="Modelo">
              <Input value={variante?.modelo ?? f.modelo} disabled placeholder="MacBook Air M2" />
            </Field>
            <Field label="N.º de serie">
              <Input
                value={f.numeroSerie}
                onChange={(e) => set("numeroSerie", e.target.value)}
                placeholder="C02XXXXXXX"
              />
            </Field>
            <Field label="CPU">
              <Input
                value={f.cpu}
                onChange={(e) => set("cpu", e.target.value)}
              />
            </Field>
            <Field label="Memoria">
              <Input value={variante?.memoria ?? f.memoria} disabled placeholder="8 GB" />
            </Field>
            <Field label="Almacenamiento">
              <Input
                value={variante?.almacenamiento ?? f.almacenamiento}
                disabled
                placeholder="256 GB SSD"
              />
            </Field>
            <Field label="Placa de video">
              <Input
                value={f.gpu}
                onChange={(e) => set("gpu", e.target.value)}
                placeholder="NVIDIA RTX 4050 6 GB"
              />
            </Field>
            <Field label="Pantalla">
              <Input
                value={f.pantalla}
                onChange={(e) => set("pantalla", e.target.value)}
                placeholder="13.6''"
              />
            </Field>
            <Field label="Color">
              <Input
                value={f.color}
                onChange={(e) => set("color", e.target.value)}
              />
            </Field>
            <Field label="Idioma">
              <Input
                value={f.idioma}
                onChange={(e) => set("idioma", e.target.value)}
              />
            </Field>
            <Field label="Estado">
              <Select
                value={f.estado}
                onChange={(e) => set("estado", e.target.value as CelularStatus)}
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {celularStatus[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Condición">
              <Select value={condicion} disabled>
                <option value="nuevo">Nueva</option>
                <option value="usado">Usada</option>
              </Select>
            </Field>
            {usado && (
              <Field label="Batería (% de salud)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={f.bateria ?? ""}
                  onChange={(e) =>
                    set(
                      "bateria",
                      e.target.value === ""
                        ? null
                        : Math.min(
                            100,
                            Math.max(0, Math.round(Number(e.target.value))),
                          ),
                    )
                  }
                  placeholder="Ej. 87"
                />
              </Field>
            )}
            <Field label="Garantía">
              <Input
                value={f.garantia}
                onChange={(e) => set("garantia", e.target.value)}
                placeholder="6 meses"
              />
            </Field>
            <Field label="Costo USD">
              <Input
                type="number"
                value={f.costoUsd}
                onChange={(e) => set("costoUsd", Number(e.target.value))}
              />
            </Field>
            <Field label="Precio USD">
              <Input
                type="number"
                disabled={!!variante && !f.precioPropio}
                value={precioEfectivo}
                onChange={(e) => set("precioUsd", Number(e.target.value))}
              />
            </Field>
          </GrillaCampos>
          {variante && (
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-neutral-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                checked={f.precioPropio}
                onChange={(e) => {
                  const propio = e.target.checked;
                  setF((p) => ({
                    ...p,
                    precioPropio: propio,
                    precioUsd: propio ? p.precioUsd || variante.precioUsd : variante.precioUsd,
                  }));
                }}
              />
              Precio propio para esta notebook
              <span className="text-[11px] text-neutral-500">
                (si no, sigue al de la variante)
              </span>
            </label>
          )}
          <Field label="Notas">
            <Textarea
              value={f.notas}
              onChange={(e) => set("notas", e.target.value)}
            />
          </Field>
          {edit && <MovimientosLog movimientos={movimientos} />}
        </div>
      </Dialog>
      {!edit && !modoCompra && (
        <ConfirmarAltaDialog
          open={confirmAlta}
          onClose={() => setConfirmAlta(false)}
          onConfirm={submit}
          pending={pending}
          exito={altaOk}
          onExitoTerminado={onClose}
          title="Confirmar ingreso al stock"
          pregunta="¿Agregar esta notebook al inventario? Ingresa en estado «En revisión»."
          confirmLabel="Agregar al stock"
          filas={[
            { label: "Variante", value: variante?.sku ?? "—" },
            { label: "Modelo", value: variante?.modelo ?? f.modelo.trim() },
            { label: "N.º de serie", value: f.numeroSerie.trim() || "—" },
            {
              label: "Condición",
              value: usado ? `Usada · batería ${f.bateria ?? "—"}%` : "Nueva",
            },
            { label: "Costo", value: fmtUsd(f.costoUsd) },
            { label: "Precio", value: fmtUsd(precioEfectivo) },
          ]}
        />
      )}
      {onDelete && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete();
          }}
          title="¿Eliminar notebook?"
          confirmLabel="Eliminar notebook"
        >
          Se eliminará «{notebook?.modelo}» del inventario. Esta acción no se
          puede deshacer.
        </ConfirmDialog>
      )}
    </Fragment>
  );
}

function RepuestoFormDialog({
  repuesto,
  open,
  onClose,
  onSubmit,
  onDelete,
  puedeVerCosto,
}: {
  repuesto: Repuesto | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (r: RepuestoInput) => void | Promise<void>;
  onDelete?: () => void;
  /** false para vendedor -- este dialog es siempre "editar un repuesto ya
   * cargado" (el alta/ingreso va por `IngresoDialog`, que no muestra costo
   * existente). */
  puedeVerCosto: boolean;
}) {
  const [f, setF] = useState<Repuesto>(
    repuesto ?? {
      id: "",
      sku: "",
      nombre: "",
      modelo: "",
      stock: 0,
      stockMin: 2,
      costoUsd: 0,
      proveedor: "",
    },
  );
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof Repuesto>(k: K, v: Repuesto[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const valid = !!f.nombre.trim() && f.costoUsd > 0;
  const movimientos = useMovimientos("repuesto", repuesto?.id ?? null);

  return (
    <Fragment>
      <Dialog
        open={open}
        onClose={onClose}
        size="3xl"
        title={repuesto ? `Repuesto · ${repuesto.nombre}` : "Repuesto"}
        description={repuesto ? `${repuesto.modelo} · ${repuesto.sku}` : ""}
        footer={
          <>
            {onDelete && (
              <Button
                icon={Trash2}
                onClick={() => setConfirmDelete(true)}
                variant="danger-outline"
                fullOnMobile
                className="sm:mr-auto"
              >
                Eliminar repuesto
              </Button>
            )}
            <Button onClick={onClose} variant="outline" fullOnMobile>
              Cancelar
            </Button>
            <Button
              disabled={!valid || pending}
              onClick={() =>
                startTransition(async () => {
                  await onSubmit({
                    sku: f.sku,
                    nombre: f.nombre.trim(),
                    modelo: f.modelo,
                    stock: f.stock,
                    stockMin: f.stockMin,
                    costoUsd: f.costoUsd,
                    proveedor: f.proveedor,
                  });
                })
              }
              variant="primary"
              fullOnMobile
            >
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Información general
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Nombre">
                <Input
                  value={f.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                />
              </Field>
              <Field label="SKU">
                <Input
                  value={f.sku}
                  onChange={(e) => set("sku", e.target.value)}
                />
              </Field>
              <Field label="Modelo">
                <Input
                  value={f.modelo}
                  onChange={(e) => set("modelo", e.target.value)}
                />
              </Field>
              <Field label="Proveedor">
                <Input
                  value={f.proveedor}
                  onChange={(e) => set("proveedor", e.target.value)}
                />
              </Field>
              <Field label="Stock">
                <Input
                  type="number"
                  min={0}
                  value={f.stock}
                  onChange={(e) => set("stock", Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Stock mínimo">
                <Input
                  type="number"
                  min={0}
                  value={f.stockMin}
                  onChange={(e) => set("stockMin", Number(e.target.value) || 0)}
                />
              </Field>
              {puedeVerCosto && (
                <Field label="Costo (U$)">
                  <Input
                    type="number"
                    min={0}
                    value={f.costoUsd || ""}
                    onChange={(e) =>
                      set("costoUsd", Number(e.target.value) || 0)
                    }
                  />
                </Field>
              )}
            </div>
          </div>

          {repuesto && <MovimientosLog movimientos={movimientos} />}
        </div>
      </Dialog>
      {onDelete && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete();
          }}
          title="¿Eliminar repuesto?"
          confirmLabel="Eliminar repuesto"
        >
          Se eliminará «{repuesto?.nombre}» del inventario. Esta acción no se
          puede deshacer.
        </ConfirmDialog>
      )}
    </Fragment>
  );
}

function OtroFormDialog({
  item,
  open,
  onClose,
  onSubmit,
  onDelete,
  puedeVerCosto,
}: {
  item: OtroItem | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (o: OtroItem) => void | Promise<void>;
  onDelete?: () => void;
  /** false para vendedor -- este dialog es siempre "editar un producto ya
   * cargado" (el alta/ingreso va por `IngresoDialog`, que no muestra costo
   * existente). Sumar unidades serializadas nuevas desde acá también se
   * oculta -- para eso ya está "Agregar / ingresar producto". */
  puedeVerCosto: boolean;
}) {
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? "");
  const [categoria, setCategoria] = useState<OtroCategoria>(
    item?.categoria ?? "otro",
  );
  const [precioUsd, setPrecioUsd] = useState(item?.precioUsd ?? 0);
  const [serializado, setSerializado] = useState(item?.serializado ?? false);
  const [cantidad, setCantidad] = useState(
    item && !item.serializado ? item.cantidad : 1,
  );
  const [costoUsd, setCostoUsd] = useState(
    item && !item.serializado ? item.costoUsd : 0,
  );
  const [unidadesManual, setUnidadesManual] = useState<DraftUnidad[]>(
    item && item.serializado
      ? item.unidades.map((u) => ({
          serial: u.serial,
          color: u.color ?? "",
          costoUsd: u.costoUsd,
        }))
      : [emptyUnidad()],
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkColor, setBulkColor] = useState("");
  const [bulkCosto, setBulkCosto] = useState(0);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const unidadesLimpias: OtroUnidad[] = unidadesManual
    .filter((u) => u.serial.trim())
    .map((u) => ({
      serial: u.serial.trim(),
      color: u.color.trim() || undefined,
      costoUsd: u.costoUsd,
    }));
  const costoPromedio = unidadesLimpias.length
    ? Math.round(
        unidadesLimpias.reduce((a, u) => a + u.costoUsd, 0) /
          unidadesLimpias.length,
      )
    : 0;
  const movimientos = useMovimientos("otro", item?.id ?? null);

  function toggleSerializado(v: boolean) {
    if (v === serializado) return;
    if (v) {
      setUnidadesManual(
        Array.from({ length: Math.max(cantidad, 1) }, () => ({
          serial: "",
          color: "",
          costoUsd,
        })),
      );
    } else {
      setCantidad(Math.max(unidadesLimpias.length, 1));
      setCostoUsd(costoPromedio || 1);
    }
    setSerializado(v);
  }
  const updUnidad = (i: number, patch: Partial<DraftUnidad>) =>
    setUnidadesManual((p) =>
      p.map((u, idx) => (idx === i ? { ...u, ...patch } : u)),
    );
  const addUnidad = () => setUnidadesManual((p) => [...p, emptyUnidad()]);
  const rmUnidad = (i: number) =>
    setUnidadesManual((p) =>
      p.length > 1 ? p.filter((_, idx) => idx !== i) : p,
    );
  function aplicarBulk() {
    const nuevas = bulkText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((serial) => ({ serial, color: bulkColor, costoUsd: bulkCosto }));
    if (!nuevas.length) return;
    setUnidadesManual((p) => [...p.filter((u) => u.serial.trim()), ...nuevas]);
    setBulkText("");
    setBulkOpen(false);
  }

  const valid =
    !!nombre.trim() &&
    precioUsd > 0 &&
    (serializado
      ? unidadesLimpias.length > 0 &&
        unidadesLimpias.every((u) => u.costoUsd > 0)
      : cantidad > 0 && costoUsd > 0);

  return (
    <Fragment>
      <Dialog
        open={open}
        onClose={onClose}
        size="3xl"
        title={item ? `Producto · ${item.nombre}` : "Producto"}
        description={item ? otroCategoria[item.categoria].label : ""}
        footer={
          <>
            {onDelete && (
              <Button
                icon={Trash2}
                onClick={() => setConfirmDelete(true)}
                variant="danger-outline"
                fullOnMobile
                className="sm:mr-auto"
              >
                Eliminar producto
              </Button>
            )}
            <Button onClick={onClose} variant="outline" fullOnMobile>
              Cancelar
            </Button>
            <Button
              disabled={!valid || !item || pending}
              onClick={() =>
                item &&
                startTransition(async () => {
                  await onSubmit({
                    id: item.id,
                    nombre: nombre.trim(),
                    descripcion: descripcion.trim() || undefined,
                    categoria,
                    precioUsd,
                    ...(serializado
                      ? { serializado: true, unidades: unidadesLimpias }
                      : { serializado: false, cantidad, costoUsd }),
                  });
                })
              }
              variant="primary"
              fullOnMobile
            >
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Información general
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Nombre">
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </Field>
              <Field label="Categoría">
                <Select
                  value={categoria}
                  onChange={(e) =>
                    setCategoria(e.target.value as OtroCategoria)
                  }
                >
                  {CATS.map((c) => (
                    <option key={c} value={c}>
                      {otroCategoria[c].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Serializado">
                <div className="flex h-9 rounded-lg border border-neutral-200 p-0.5">
                  {(["no", "si"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleSerializado(v === "si")}
                      className={cn(
                        "flex-1 rounded-md text-[13px] font-medium transition-colors",
                        (v === "si") === serializado
                          ? "bg-accent-soft text-accent"
                          : "text-neutral-500 hover:bg-neutral-50",
                      )}
                    >
                      {v === "si" ? "Sí" : "No"}
                    </button>
                  ))}
                </div>
              </Field>
              <Field
                label="Descripción"
                className="col-span-1 sm:col-span-2 lg:col-span-3"
              >
                <Input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Opcional"
                />
              </Field>
              {puedeVerCosto && (
                <Field label="Costo (U$)">
                  {serializado ? (
                    <div className="flex h-9 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-500">
                      {fmtUsd(costoPromedio)} prom.
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      value={costoUsd || ""}
                      onChange={(e) => setCostoUsd(Number(e.target.value) || 0)}
                    />
                  )}
                </Field>
              )}
              <Field label="Venta (U$)">
                <Input
                  type="number"
                  min={0}
                  value={precioUsd || ""}
                  onChange={(e) => setPrecioUsd(Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Cantidad">
                {serializado ? (
                  <div className="flex h-9 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-500">
                    {unidadesLimpias.length}
                  </div>
                ) : (
                  <Input
                    type="number"
                    min={0}
                    value={cantidad}
                    onChange={(e) => setCantidad(Number(e.target.value) || 0)}
                  />
                )}
              </Field>
              {serializado && (
                <Field
                  label="Unidades"
                  className="col-span-1 sm:col-span-2 lg:col-span-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      <span className="flex-1">Serial</span>
                      <span className="w-28 text-center">Color</span>
                      {puedeVerCosto && (
                        <span className="w-24 text-center">Costo</span>
                      )}
                      <span className="w-9" />
                    </div>
                    {unidadesManual.map((u, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          className="min-w-0 flex-1"
                          value={u.serial}
                          onChange={(e) =>
                            updUnidad(i, { serial: e.target.value })
                          }
                          placeholder={`Serial ${i + 1}`}
                        />
                        <Input
                          className="w-28"
                          value={u.color}
                          onChange={(e) =>
                            updUnidad(i, { color: e.target.value })
                          }
                          placeholder="Color"
                        />
                        {puedeVerCosto && (
                          <Input
                            className="w-24"
                            type="number"
                            min={0}
                            value={u.costoUsd || ""}
                            placeholder="U$"
                            onChange={(e) =>
                              updUnidad(i, {
                                costoUsd: Number(e.target.value) || 0,
                              })
                            }
                          />
                        )}
                        <IconButton
                          aria-label="Quitar"
                          icon={Trash2}
                          variant="danger-ghost"
                          size="lg"
                          onClick={() => rmUnidad(i)}
                          disabled={unidadesManual.length === 1}
                        />
                      </div>
                    ))}
                  </div>
                  {puedeVerCosto ? (
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={addUnidad}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        + Agregar unidad
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkOpen((v) => !v)}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        {bulkOpen ? "Cerrar carga en bulk" : "Cargar en bulk"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-neutral-400">
                      Para sumar unidades nuevas usá «Agregar / ingresar
                      producto».
                    </p>
                  )}
                  {puedeVerCosto && bulkOpen && (
                    <div className="mt-2 space-y-2 rounded-lg border border-dashed border-neutral-200 p-3">
                      <Textarea
                        rows={3}
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder={
                          "Un serial por línea\nIPAD9-010\nIPAD9-011"
                        }
                      />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Input
                          value={bulkColor}
                          onChange={(e) => setBulkColor(e.target.value)}
                          placeholder="Color (opcional)"
                        />
                        <Input
                          type="number"
                          min={0}
                          value={bulkCosto || ""}
                          onChange={(e) =>
                            setBulkCosto(Number(e.target.value) || 0)
                          }
                          placeholder="Costo c/u (U$)"
                        />
                        <Button type="button" onClick={aplicarBulk}>
                          Agregar unidades
                        </Button>
                      </div>
                    </div>
                  )}
                </Field>
              )}
            </div>
          </div>

          {item && <MovimientosLog movimientos={movimientos} />}
        </div>
      </Dialog>
      {onDelete && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete();
          }}
          title="¿Eliminar producto?"
          confirmLabel="Eliminar producto"
        >
          Se eliminará «{item?.nombre}» del inventario. Esta acción no se puede
          deshacer.
        </ConfirmDialog>
      )}
    </Fragment>
  );
}

type DraftUnidad = { serial: string; color: string; costoUsd: number };
const emptyUnidad = (): DraftUnidad => ({ serial: "", color: "", costoUsd: 0 });

export function IngresoDialog({
  open,
  onClose,
  titulo,
  categoria,
  defaultId,
  existentes,
  onIngreso,
  onNuevo,
  modoCompra = false,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  categoria?: boolean;
  defaultId?: string;
  existentes: { id: string; label: string; serializado?: boolean }[];
  onIngreso: (
    id: string,
    cantidad: number,
    precioCompra: number,
    unidades?: OtroUnidad[],
  ) => void | Promise<void>;
  onNuevo: (
    nombre: string,
    precioCompra: number,
    cantidad: number,
    cat?: OtroCategoria,
    unidades?: OtroUnidad[],
    precioVenta?: number,
  ) => void | Promise<void>;
  /** Plan 025: el formulario se usa para armar el carrito de una compra.
   * `onSubmit` solo agrega el ítem (no guarda) y el dialog se cierra, sin el
   * paso de «Confirmar ingreso al stock». */
  modoCompra?: boolean;
}) {
  const [modo, setModo] = useState<"nuevo" | "existente">(
    existentes.length ? "existente" : "nuevo",
  );
  const [sel, setSel] = useState(defaultId ?? existentes[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [cat, setCat] = useState<OtroCategoria>("accesorio");
  const [serializadoNuevo, setSerializadoNuevo] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState(0);
  const [precioVenta, setPrecioVenta] = useState(0);
  const [pending, startTransition] = useTransition();
  const [confirmIngreso, setConfirmIngreso] = useState(false);
  const [ingresoOk, setIngresoOk] = useState(false);

  const [modoCarga, setModoCarga] = useState<"manual" | "bulk">("manual");
  const [unidadesManual, setUnidadesManual] = useState<DraftUnidad[]>([
    emptyUnidad(),
  ]);
  const [bulkSeriales, setBulkSeriales] = useState("");
  const [bulkColor, setBulkColor] = useState("");
  const [bulkCosto, setBulkCosto] = useState(0);

  const locked = !!defaultId;
  const existenteSel = existentes.find((x) => x.id === sel);
  const esSerializado =
    modo === "existente" ? !!existenteSel?.serializado : serializadoNuevo;

  const unidadesFinal: OtroUnidad[] =
    modoCarga === "bulk"
      ? bulkSeriales
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((serial) => ({
            serial,
            color: bulkColor.trim() || undefined,
            costoUsd: bulkCosto,
          }))
      : unidadesManual
          .filter((u) => u.serial.trim())
          .map((u) => ({
            serial: u.serial.trim(),
            color: u.color.trim() || undefined,
            costoUsd: u.costoUsd,
          }));
  const costoPromedioNuevos = unidadesFinal.length
    ? Math.round(
        unidadesFinal.reduce((a, u) => a + u.costoUsd, 0) /
          unidadesFinal.length,
      )
    : 0;

  const updUnidad = (i: number, patch: Partial<DraftUnidad>) =>
    setUnidadesManual((p) =>
      p.map((u, idx) => (idx === i ? { ...u, ...patch } : u)),
    );
  const addUnidad = () => setUnidadesManual((p) => [...p, emptyUnidad()]);
  const rmUnidad = (i: number) =>
    setUnidadesManual((p) =>
      p.length > 1 ? p.filter((_, idx) => idx !== i) : p,
    );

  const valid =
    (modo === "existente" ? !!sel : !!nombre.trim()) &&
    (modo === "nuevo" && categoria ? precioVenta > 0 : true) &&
    (esSerializado
      ? unidadesFinal.length > 0 && unidadesFinal.every((u) => u.costoUsd > 0)
      : cantidad > 0 && precio > 0);

  const unidadesTotal = esSerializado ? unidadesFinal.length : cantidad;
  const costoTotal = esSerializado
    ? unidadesFinal.reduce((a, u) => a + u.costoUsd, 0)
    : cantidad * precio;

  async function ingresar() {
    if (modo === "existente") {
      await onIngreso(
        sel,
        esSerializado ? unidadesFinal.length : cantidad,
        esSerializado ? costoPromedioNuevos : precio,
        esSerializado ? unidadesFinal : undefined,
      );
    } else {
      await onNuevo(
        nombre.trim(),
        esSerializado ? costoPromedioNuevos : precio,
        esSerializado ? unidadesFinal.length : cantidad,
        categoria ? cat : undefined,
        esSerializado ? unidadesFinal : undefined,
        categoria ? precioVenta : undefined,
      );
    }
  }

  function submit() {
    startTransition(async () => {
      try {
        await ingresar();
        if (modoCompra) onClose();
        else setIngresoOk(true);
      } catch (e) {
        setConfirmIngreso(false);
        throw e;
      }
    });
  }

  return (
    <Fragment>
    <Dialog
      open={open}
      onClose={onClose}
      size="3xl"
      formulario
      title={
        modoCompra
          ? `Agregar ${titulo} a la compra`
          : locked
            ? "Reponer stock"
            : `Agregar / ingresar ${titulo}`
      }
      description={
        locked
          ? (existenteSel?.label ?? "")
          : "Sumá unidades a un ítem existente o creá uno nuevo."
      }
      footer={
        <>
          <Button onClick={onClose} variant="outline" fullOnMobile>
            Cancelar
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={() => (modoCompra ? submit() : setConfirmIngreso(true))}
            variant="primary"
            fullOnMobile
          >
            {pending
              ? "Guardando…"
              : modoCompra
                ? "Agregar a la compra"
                : locked
                ? "Reponer"
                : modo === "existente"
                  ? "Ingresar stock"
                  : "Crear"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {!locked && (
          <div className="flex rounded-lg border border-neutral-200 p-0.5">
            {(["existente", "nuevo"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={m === "existente" && existentes.length === 0}
                onClick={() => setModo(m)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-40",
                  modo === m
                    ? "bg-accent-soft text-accent"
                    : "text-neutral-500 hover:bg-neutral-50",
                )}
              >
                {m === "existente" ? "Sumar a existente" : "Nuevo"}
              </button>
            ))}
          </div>
        )}

        {modo === "existente" ? (
          <Field label={titulo}>
            {locked ? (
              <div className="flex h-9 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700">
                {existenteSel?.label}
                {existenteSel?.serializado ? " (serializado)" : ""}
              </div>
            ) : (
              <Select value={sel} onChange={(e) => setSel(e.target.value)}>
                {existentes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                    {x.serializado ? " (serializado)" : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <>
            <Field label="Nombre">
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={
                  categoria ? "iPad 10ma gen 64GB" : "Pantalla OLED iPhone 14"
                }
              />
            </Field>
            {categoria && (
              <GrillaCampos>
                <Field label="Categoría">
                  <Select
                    value={cat}
                    onChange={(e) => setCat(e.target.value as OtroCategoria)}
                  >
                    {CATS.map((c) => (
                      <option key={c} value={c}>
                        {otroCategoria[c].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Serializado">
                  <div className="flex h-9 rounded-lg border border-neutral-200 p-0.5">
                    {(["no", "si"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setSerializadoNuevo(v === "si")}
                        className={cn(
                          "flex-1 rounded-md text-[13px] font-medium transition-colors",
                          (v === "si") === serializadoNuevo
                            ? "bg-accent-soft text-accent"
                            : "text-neutral-500 hover:bg-neutral-50",
                        )}
                      >
                        {v === "si" ? "Sí" : "No"}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Precio de venta (U$)">
                  <Input
                    type="number"
                    min={0}
                    value={precioVenta || ""}
                    onChange={(e) =>
                      setPrecioVenta(Number(e.target.value) || 0)
                    }
                    placeholder="Lo que paga el cliente"
                  />
                </Field>
              </GrillaCampos>
            )}
          </>
        )}

        {esSerializado ? (
          <div className="space-y-3">
            <div className="flex rounded-lg border border-neutral-200 p-0.5">
              {(["manual", "bulk"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModoCarga(m)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                    modoCarga === m
                      ? "bg-accent-soft text-accent"
                      : "text-neutral-500 hover:bg-neutral-50",
                  )}
                >
                  {m === "manual" ? "Uno por uno" : "Carga en bulk"}
                </button>
              ))}
            </div>

            {modoCarga === "manual" ? (
              <Field label="Unidades">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="flex-1">Serial</span>
                    <span className="w-28 text-center">Color</span>
                    <span className="w-24 text-center">Costo</span>
                    <span className="w-9" />
                  </div>
                  {unidadesManual.map((u, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        className="min-w-0 flex-1"
                        value={u.serial}
                        onChange={(e) =>
                          updUnidad(i, { serial: e.target.value })
                        }
                        placeholder={`Serial ${i + 1}`}
                      />
                      <Input
                        className="w-28"
                        value={u.color}
                        onChange={(e) =>
                          updUnidad(i, { color: e.target.value })
                        }
                        placeholder="Color"
                      />
                      <Input
                        className="w-24"
                        type="number"
                        min={0}
                        value={u.costoUsd || ""}
                        placeholder="U$"
                        onChange={(e) =>
                          updUnidad(i, {
                            costoUsd: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <IconButton
                        aria-label="Quitar"
                        icon={Trash2}
                        variant="danger-ghost"
                        size="lg"
                        onClick={() => rmUnidad(i)}
                        disabled={unidadesManual.length === 1}
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addUnidad}
                  className="mt-2 text-xs font-medium text-accent hover:underline"
                >
                  + Agregar unidad
                </button>
              </Field>
            ) : (
              <>
                <Field label="Seriales (uno por línea)">
                  <Textarea
                    rows={4}
                    value={bulkSeriales}
                    onChange={(e) => setBulkSeriales(e.target.value)}
                    placeholder={"IPAD9-010\nIPAD9-011\nIPAD9-012"}
                  />
                </Field>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <Field label="Color (para todos)">
                    <Input
                      value={bulkColor}
                      onChange={(e) => setBulkColor(e.target.value)}
                      placeholder="Opcional"
                    />
                  </Field>
                  <Field label="Costo c/u (U$)">
                    <Input
                      type="number"
                      min={0}
                      value={bulkCosto || ""}
                      onChange={(e) =>
                        setBulkCosto(Number(e.target.value) || 0)
                      }
                    />
                  </Field>
                </div>
                {unidadesFinal.length > 0 && (
                  <p className="text-[11px] text-neutral-400">
                    {unidadesFinal.length} unidad
                    {unidadesFinal.length === 1 ? "" : "es"} detectada
                    {unidadesFinal.length === 1 ? "" : "s"}.
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Cantidad">
              <Input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value) || 1)}
              />
            </Field>
            <Field label="Precio compra (U$)">
              <Input
                type="number"
                min={0}
                value={precio || ""}
                onChange={(e) => setPrecio(Number(e.target.value) || 0)}
              />
            </Field>
          </div>
        )}
      </div>
    </Dialog>
    {!modoCompra && (
    <ConfirmarAltaDialog
      open={confirmIngreso}
      onClose={() => setConfirmIngreso(false)}
      onConfirm={submit}
      pending={pending}
      exito={ingresoOk}
      onExitoTerminado={onClose}
      title="Confirmar ingreso al stock"
      pregunta={
        modo === "existente"
          ? `¿Sumar ${unidadesTotal} unidad${unidadesTotal === 1 ? "" : "es"} al stock?`
          : `¿Crear «${nombre.trim()}» y cargar ${unidadesTotal} unidad${unidadesTotal === 1 ? "" : "es"}?`
      }
      confirmLabel={locked ? "Reponer" : "Confirmar ingreso"}
      filas={[
        {
          label: titulo.charAt(0).toUpperCase() + titulo.slice(1),
          value:
            modo === "existente" ? (existenteSel?.label ?? "—") : nombre.trim(),
        },
        ...(modo === "nuevo" && categoria
          ? [
              { label: "Categoría", value: otroCategoria[cat].label },
              { label: "Precio de venta", value: fmtUsd(precioVenta) },
            ]
          : []),
        { label: "Unidades", value: unidadesTotal },
        { label: "Costo total", value: fmtUsd(costoTotal) },
      ]}
    />
    )}
    </Fragment>
  );
}
