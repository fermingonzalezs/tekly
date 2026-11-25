"use client";

import { Fragment, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Link2,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { CopiarTexto } from "@/components/copiar-texto";
import { IconButton } from "@/components/ui/button";
import { MenuAcciones, type AccionMenu } from "@/components/ui/menu-acciones";
import { copyCelular, copyNotebook } from "@/lib/difusion";
import { fmtUsd } from "@/lib/format";
import { celularStatus, dotClass } from "@/lib/status";
import { thDivider } from "@/lib/ui-styles";
import {
  agruparPorGrupo,
  condicionLabel,
  nombreVariante,
  ordenarGrupos,
  rangoPrecio,
  stockDeVariante,
} from "@/lib/variantes";
import { cn } from "@/lib/utils";
import type { Celular, Notebook, Variante, VarianteCategoria } from "@/lib/types";

/** Vista agrupada de Inventario → Celulares / Notebooks: grupo › variante ›
 * unidades.
 * Los filtros de la sección (búsqueda/estado) se aplican a las **unidades**:
 * una variante sin unidades que coincidan no se muestra (salvo que no haya
 * ningún filtro activo, donde se ven todas para poder cargarles stock). */
export function VariantesTabla({
  categoria = "celular",
  variantes: todasLasVariantes,
  celulares = [],
  notebooks = [],
  unidadesFiltradas,
  hayFiltro,
  verDesactivadas,
  esAdmin,
  puedeVerCosto,
  onAbrirUnidad,
  onAgregarUnidad,
  onEditar,
  onRenombrarGrupo,
  onUnir,
  onDesactivar,
  onEliminar,
  onReactivar,
}: {
  categoria?: VarianteCategoria;
  /** Todas (activas y no), ya ordenadas por grupo/sku desde el server. Se
   * filtran a la `categoria`. */
  variantes: Variante[];
  celulares?: Celular[];
  notebooks?: Notebook[];
  unidadesFiltradas: { id: string }[];
  hayFiltro: boolean;
  verDesactivadas: boolean;
  esAdmin: boolean;
  puedeVerCosto: boolean;
  onAbrirUnidad: (id: string) => void;
  onAgregarUnidad: (variante: Variante) => void;
  onEditar: (variante: Variante) => void;
  onRenombrarGrupo: (grupo: string) => void;
  onUnir: (variante: Variante) => void;
  onDesactivar: (variante: Variante) => void;
  onEliminar: (variante: Variante) => void;
  onReactivar: (variante: Variante) => void;
}) {
  // Los grupos arrancan plegados (se ve el resumen de cada uno); con una
  // búsqueda o filtro activos arrancan abiertos, para ver qué coincidió. El
  // set guarda los grupos que el usuario invirtió con el chevron.
  const [gruposInvertidos, setGruposInvertidos] = useState<Set<string>>(new Set());
  const [variantesAbiertas, setVariantesAbiertas] = useState<Set<string>>(new Set());

  const esNotebook = categoria === "notebook";
  const variantes = useMemo(
    () => todasLasVariantes.filter((v) => v.categoria === categoria),
    [todasLasVariantes, categoria],
  );
  const unidades: (Celular | Notebook)[] = esNotebook ? notebooks : celulares;
  const idsFiltrados = useMemo(
    () => new Set(unidadesFiltradas.map((u) => u.id)),
    [unidadesFiltradas],
  );
  const unidadesDe = (varianteId: string) =>
    unidades.filter((u) => u.varianteId === varianteId && idsFiltrados.has(u.id));

  const grupos = useMemo(() => {
    const visibles = variantes.filter((v) =>
      verDesactivadas ? !v.activa : v.activa,
    );
    return ordenarGrupos(agruparPorGrupo(visibles)).filter((g) =>
      g.variantes.some((v) => !hayFiltro || unidadesDe(v.id).length > 0),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantes, verDesactivadas, hayFiltro, idsFiltrados]);

  function toggle(set: Set<string>, clave: string): Set<string> {
    const next = new Set(set);
    next.has(clave) ? next.delete(clave) : next.add(clave);
    return next;
  }

  if (grupos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
        {verDesactivadas
          ? "No hay variantes desactivadas."
          : hayFiltro
            ? "Sin variantes para esta búsqueda."
            : "Todavía no hay variantes cargadas."}
      </p>
    );
  }

  const th = cn("px-4 py-3", thDivider);
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs">
            <th className={th}>Grupo</th>
            <th className={th}>Variantes</th>
            <th className={th}>Disponibles</th>
            <th className={th}>Precio</th>
            <th className="w-px px-3 py-3">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => {
            const abierto = hayFiltro !== gruposInvertidos.has(grupo.clave);
            const unidadesGrupo = grupo.variantes.flatMap((v) => unidadesDe(v.id));
            const disponiblesGrupo = unidadesGrupo.filter((u) => u.estado === "disponible").length;
            // Alerta del grupo: sin stock (rojo) o alguna variante activa por
            // debajo de su stock mínimo (ámbar). Mismo criterio que el chip
            // «Stock bajo» de cada variante, con el stock real (sin filtros).
            const variantesBajas = grupo.variantes.filter(
              (v) =>
                v.activa &&
                v.stockMinimo > 0 &&
                stockDeVariante(v, unidades).disponibles < v.stockMinimo,
            ).length;
            const alertaGrupo: "red" | "amber" | null =
              disponiblesGrupo === 0 ? "red" : variantesBajas > 0 ? "amber" : null;
            const precios = grupo.variantes.map((v) => rangoPrecio(v, unidades));
            const min = Math.min(...precios.map((p) => p[0]));
            const max = Math.max(...precios.map((p) => p[1]));
            const variantesVisibles = grupo.variantes.filter(
              (v) => !hayFiltro || unidadesDe(v.id).length > 0,
            );
            return (
              <Fragment key={grupo.clave}>
                <tr
                  className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                  onClick={() => setGruposInvertidos((s) => toggle(s, grupo.clave))}
                >
                  <td className="px-4 py-2.5">
                    <span className="flex items-center justify-center gap-2 font-semibold text-neutral-900">
                      {abierto ? (
                        <ChevronDown className="h-4 w-4 text-neutral-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-neutral-500" />
                      )}
                      {grupo.grupo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-neutral-600">
                    {grupo.variantes.length}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {alertaGrupo ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-semibold",
                          alertaGrupo === "red" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800",
                        )}
                        title={
                          alertaGrupo === "red"
                            ? "Sin stock disponible"
                            : variantesBajas === 1
                              ? "1 variante con stock bajo"
                              : variantesBajas + " variantes con stock bajo"
                        }
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[alertaGrupo])} />
                        {disponiblesGrupo}
                      </span>
                    ) : (
                      disponiblesGrupo
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {min === max ? fmtUsd(min) : `${fmtUsd(min)} – ${fmtUsd(max)}`}
                  </td>
                  <td className="w-px px-3 py-2.5">
                    <IconButton
                      aria-label={`Renombrar grupo ${grupo.grupo}`}
                      icon={Pencil}
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRenombrarGrupo(grupo.grupo);
                      }}
                    />
                  </td>
                </tr>
                {abierto && (
                  <tr className="border-t border-neutral-100">
                    <td colSpan={5} className="bg-neutral-50 px-4 py-3 pl-8">
                      <Anidada>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs">
                              <th className={cn("px-4 py-2", thDivider)}>Variante</th>
                              {esNotebook && (
                                <th className={cn("px-4 py-2", thDivider)}>Memoria</th>
                              )}
                              <th className={cn("px-4 py-2", thDivider)}>Almacenamiento</th>
                              <th className={cn("px-4 py-2", thDivider)}>Condición</th>
                              {!esNotebook && (
                                <th className={cn("px-4 py-2", thDivider)}>Color</th>
                              )}
                              <th className={cn("px-4 py-2", thDivider)}>Stock</th>
                              <th className={cn("px-4 py-2", thDivider)}>Precio</th>
                              <th className="w-px px-3 py-2">
                                <span className="sr-only">Acciones</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {variantesVisibles.map((variante) => {
                              const stock = stockDeVariante(variante, unidades);
                              const [pMin, pMax] = rangoPrecio(variante, unidades);
                              const acciones: AccionMenu[] = [
                                { label: "Editar variante", icon: Pencil, onClick: () => onEditar(variante) },
                                { label: "Agregar unidad", icon: Plus, onClick: () => onAgregarUnidad(variante) },
                                ...(esAdmin
                                  ? [
                                      { label: "Unir con…", icon: Link2, onClick: () => onUnir(variante) },
                                      variante.activa
                                        ? { label: "Desactivar", icon: Power, onClick: () => onDesactivar(variante) }
                                        : { label: "Reactivar", icon: RotateCcw, onClick: () => onReactivar(variante) },
                                      { label: "Eliminar", icon: Trash2, onClick: () => onEliminar(variante) },
                                    ]
                                  : []),
                              ];
                              return (
                                <VarianteRows
                                  key={variante.id}
                                  variante={variante}
                                  esNotebook={esNotebook}
                                  expandida={variantesAbiertas.has(variante.id)}
                                  onToggle={() => setVariantesAbiertas((s) => toggle(s, variante.id))}
                                  stock={stock}
                                  bajoMinimo={
                                    variante.activa &&
                                    variante.stockMinimo > 0 &&
                                    stock.disponibles < variante.stockMinimo
                                  }
                                  precio={pMin === pMax ? fmtUsd(pMin) : `${fmtUsd(pMin)} – ${fmtUsd(pMax)}`}
                                  unidades={unidadesDe(variante.id)}
                                  puedeVerCosto={puedeVerCosto}
                                  acciones={acciones}
                                  onAbrirUnidad={onAbrirUnidad}
                                />
                              );
                            })}
                          </tbody>
                        </table>
                      </Anidada>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Contenedor de una tabla anidada. `contain: inline-size` hace que su ancho
 * no dependa del contenido: si la tabla de adentro no entra, scrollea acá en
 * vez de ensanchar la tabla de afuera. */
function Anidada({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-neutral-200 bg-white [contain:inline-size]">
      {children}
    </div>
  );
}

function VarianteRows({
  variante,
  esNotebook,
  expandida,
  onToggle,
  stock,
  bajoMinimo,
  precio,
  unidades,
  puedeVerCosto,
  acciones,
  onAbrirUnidad,
}: {
  variante: Variante;
  esNotebook: boolean;
  expandida: boolean;
  onToggle: () => void;
  stock: { disponibles: number; reservadas: number; enRevision: number };
  bajoMinimo: boolean;
  precio: string;
  unidades: (Celular | Notebook)[];
  puedeVerCosto: boolean;
  acciones: AccionMenu[];
  onAbrirUnidad: (id: string) => void;
}) {
  const chip = "inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700";
  return (
    <>
      <tr
        className={cn(
          "cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50",
          !variante.activa && "text-neutral-400",
        )}
        onClick={onToggle}
      >
        <td className="px-4 py-2">
          <span className="flex items-center justify-center gap-2">
            {expandida ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            )}
            <span className="min-w-0">
              <span className="block truncate font-mono text-xs text-accent">{variante.sku}</span>
              <span className="block truncate text-xs text-neutral-500">{nombreVariante(variante)}</span>
            </span>
          </span>
        </td>
        {esNotebook && <td className="px-4 py-2">{variante.memoria || "—"}</td>}
        <td className="px-4 py-2">{variante.almacenamiento || "—"}</td>
        <td className="px-4 py-2">{condicionLabel(variante.condicion) || "—"}</td>
        {!esNotebook && (
          <td className="px-4 py-2 text-neutral-500">{variante.color || "Cualquiera"}</td>
        )}
        <td className="px-4 py-2">
          <span className="inline-flex flex-wrap items-center justify-center gap-1">
            <span
              className={cn(
                chip,
                "font-medium",
                stock.disponibles === 0 && variante.activa
                  ? "bg-red-50 text-red-700"
                  : bajoMinimo && "bg-amber-50 text-amber-800",
              )}
              title="Disponibles"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  stock.disponibles === 0 && variante.activa
                    ? dotClass.red
                    : bajoMinimo
                      ? dotClass.amber
                      : dotClass.green,
                )}
              />
              {stock.disponibles}
            </span>
            {stock.reservadas > 0 && (
              <span className={chip} title="Reservadas">
                <span className={cn("h-1.5 w-1.5 rounded-full", dotClass.blue)} />
                {stock.reservadas}
              </span>
            )}
            {stock.enRevision > 0 && (
              <span className={chip} title="En revisión">
                <span className={cn("h-1.5 w-1.5 rounded-full", dotClass.amber)} />
                {stock.enRevision}
              </span>
            )}
            {bajoMinimo && (
              <span className={cn(chip, "font-medium")} title={`Stock mínimo: ${variante.stockMinimo}`}>
                <span className={cn("h-1.5 w-1.5 rounded-full", dotClass.amber)} />
                Stock bajo
              </span>
            )}
            {!variante.activa && <span className={cn(chip, "text-neutral-500")}>Desactivada</span>}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-2 tabular-nums">{precio}</td>
        <td className="w-px px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <MenuAcciones label={`Acciones de ${variante.sku}`} acciones={acciones} variant="ghost" />
        </td>
      </tr>
      {expandida && (
        <tr className="border-t border-neutral-100">
          <td colSpan={7} className="bg-neutral-50 px-4 py-3 pl-8">
            {unidades.length === 0 ? (
              <p className="text-start text-xs text-neutral-500">Sin unidades cargadas en esta variante.</p>
            ) : esNotebook ? (
              <NotebooksSubtabla
                unidades={unidades as Notebook[]}
                puedeVerCosto={puedeVerCosto}
                onAbrirUnidad={onAbrirUnidad}
              />
            ) : (
              <UnidadesSubtabla
                unidades={unidades as Celular[]}
                puedeVerCosto={puedeVerCosto}
                onAbrirUnidad={onAbrirUnidad}
              />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/** Unidades de una variante, con las mismas columnas que la vista
 * «Unidades» de Inventario → Celulares (encabezado propio dentro de la
 * variante abierta). */
function UnidadesSubtabla({
  unidades,
  puedeVerCosto,
  onAbrirUnidad,
}: {
  unidades: Celular[];
  puedeVerCosto: boolean;
  onAbrirUnidad: (id: string) => void;
}) {
  const th = cn("px-4 py-2", thDivider);
  return (
    <Anidada>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs">
            <th className={th}>Celular</th>
            <th className={th}>Color</th>
            <th className={th}>Almacenamiento</th>
            <th className={th}>IMEI/Serial</th>
            <th className={th}>Batería</th>
            <th className={th}>Condición</th>
            {puedeVerCosto && <th className={th}>Costo</th>}
            <th className={th}>Venta</th>
            {puedeVerCosto && <th className={th}>Margen</th>}
            <th className={th}>Estado</th>
            <th className="w-px px-3 py-2">
              <span className="sr-only">Copiar texto para publicar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {unidades.map((u) => (
            <tr
              key={u.id}
              onClick={() => onAbrirUnidad(u.id)}
              className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
            >
              <td className="max-w-[160px] truncate px-4 py-2 font-medium">
                {u.modelo}
              </td>
              <td className="max-w-[110px] truncate px-4 py-2 text-neutral-500">
                {u.color || "—"}
              </td>
              <td className="px-4 py-2 tabular-nums">{u.almacenamiento || "—"}</td>
              <td className="px-4 py-2 font-mono text-xs text-neutral-500">{u.imei || "—"}</td>
              <td className="px-4 py-2 tabular-nums">{u.bateria}%</td>
              <td className="px-4 py-2 text-neutral-500">{u.condicion || "—"}</td>
              {puedeVerCosto && (
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-neutral-500">{fmtUsd(u.costoUsd)}</td>
              )}
              <td className="whitespace-nowrap px-4 py-2 font-semibold tabular-nums">
                {fmtUsd(u.precioUsd)}
                {u.precioPropio && (
                  <span className="ml-1 text-[10px] font-normal uppercase tracking-wide text-neutral-500">
                    propio
                  </span>
                )}
              </td>
              {puedeVerCosto && (
                <td className="px-4 py-2 tabular-nums text-emerald-600">
                  {u.precioUsd > 0
                    ? `${(((u.precioUsd - u.costoUsd) / u.precioUsd) * 100).toFixed(0)}%`
                    : "—"}
                </td>
              )}
              <td className="px-4 py-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", dotClass[celularStatus[u.estado].tone])}
                  />
                  {celularStatus[u.estado].label}
                </span>
              </td>
              <td className="w-px px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <CopiarTexto texto={copyCelular(u)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Anidada>
  );
}

/** Unidades de una variante de notebooks: lo que distingue a cada una (serie,
 * CPU, pantalla, color, batería) + precio y estado. */
function NotebooksSubtabla({
  unidades,
  puedeVerCosto,
  onAbrirUnidad,
}: {
  unidades: Notebook[];
  puedeVerCosto: boolean;
  onAbrirUnidad: (id: string) => void;
}) {
  const th = cn("px-4 py-2", thDivider);
  return (
    <Anidada>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs">
            <th className={th}>Notebook</th>
            <th className={th}>N.º de serie</th>
            <th className={th}>CPU</th>
            <th className={th}>Pantalla</th>
            <th className={th}>Color</th>
            <th className={th}>Batería</th>
            {puedeVerCosto && <th className={th}>Costo</th>}
            <th className={th}>Venta</th>
            {puedeVerCosto && <th className={th}>Margen</th>}
            <th className={th}>Estado</th>
            <th className="w-px px-3 py-2">
              <span className="sr-only">Copiar texto para publicar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {unidades.map((u) => (
            <tr
              key={u.id}
              onClick={() => onAbrirUnidad(u.id)}
              className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
            >
              <td className="max-w-[160px] truncate px-4 py-2 font-medium">{u.modelo}</td>
              <td className="px-4 py-2 font-mono text-xs text-neutral-500">{u.numeroSerie || "—"}</td>
              <td className="max-w-[140px] truncate px-4 py-2">{u.cpu || "—"}</td>
              <td className="px-4 py-2">{u.pantalla || "—"}</td>
              <td className="max-w-[110px] truncate px-4 py-2 text-neutral-500">{u.color || "—"}</td>
              <td className="px-4 py-2 tabular-nums">
                {u.condicion === "usado" && u.bateria !== null ? `${u.bateria}%` : "—"}
              </td>
              {puedeVerCosto && (
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-neutral-500">{fmtUsd(u.costoUsd)}</td>
              )}
              <td className="whitespace-nowrap px-4 py-2 font-semibold tabular-nums">
                {fmtUsd(u.precioUsd)}
                {u.precioPropio && (
                  <span className="ml-1 text-[10px] font-normal uppercase tracking-wide text-neutral-500">
                    propio
                  </span>
                )}
              </td>
              {puedeVerCosto && (
                <td className="px-4 py-2 tabular-nums text-emerald-600">
                  {u.precioUsd > 0
                    ? `${(((u.precioUsd - u.costoUsd) / u.precioUsd) * 100).toFixed(0)}%`
                    : "—"}
                </td>
              )}
              <td className="px-4 py-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", dotClass[celularStatus[u.estado].tone])}
                  />
                  {celularStatus[u.estado].label}
                </span>
              </td>
              <td className="w-px px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <CopiarTexto texto={copyNotebook(u)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Anidada>
  );
}
