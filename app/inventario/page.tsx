"use client";

import { useState } from "react";
import { Plus, ClipboardCheck, Search } from "lucide-react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { InventarioValor } from "@/components/inventario-valor";
import {
  equipoStatus,
  otroCategoria,
  repuestoEstado,
  dotClass,
} from "@/lib/status";
import { filterPill, thDivider } from "@/lib/ui-styles";
import { GHOST_STRIPES } from "@/lib/chart";
import {
  equipos as equiposSeed,
  repuestos as repuestosSeed,
  otros as otrosSeed,
} from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  Equipo,
  EquipoStatus,
  OtroCategoria,
  OtroItem,
  Repuesto,
} from "@/lib/types";

type Tab = "equipos" | "repuestos" | "otros";
const rid = () => Math.random().toString(36).slice(2);
const CATS: OtroCategoria[] = ["ipad", "airpods", "tablet", "accesorio", "otro"];

export default function InventarioPage() {
  const [tab, setTab] = useState<Tab>("equipos");
  const [equipos, setEquipos] = useState<Equipo[]>(equiposSeed);
  const [repuestos, setRepuestos] = useState<Repuesto[]>(repuestosSeed);
  const [otros, setOtros] = useState<OtroItem[]>(otrosSeed);

  const [recuento, setRecuento] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");

  const [addEquipo, setAddEquipo] = useState(false);
  const [addRepuesto, setAddRepuesto] = useState(false);
  const [addOtro, setAddOtro] = useState(false);
  const [openEquipoId, setOpenEquipoId] = useState<string | null>(null);
  const [reponerId, setReponerId] = useState<string | null>(null);
  const openEquipo = equipos.find((e) => e.id === openEquipoId) ?? null;

  function reponer(id: string) {
    setReponerId(id);
    setAddRepuesto(true);
  }

  function switchTab(t: Tab) {
    setRecuento(false);
    setQ("");
    setTab(t);
  }

  const needle = q.trim().toLowerCase();
  const equiposFiltrados = equipos.filter(
    (e) =>
      !needle ||
      e.modelo.toLowerCase().includes(needle) ||
      e.color.toLowerCase().includes(needle) ||
      e.imei.toLowerCase().includes(needle),
  );
  const repuestosFiltrados = repuestos.filter(
    (r) =>
      !needle ||
      r.nombre.toLowerCase().includes(needle) ||
      r.sku.toLowerCase().includes(needle) ||
      r.modelo.toLowerCase().includes(needle) ||
      r.proveedor.toLowerCase().includes(needle),
  );
  const otrosFiltrados = otros.filter(
    (o) => !needle || o.nombre.toLowerCase().includes(needle),
  );

  function startRecuento() {
    const d: Record<string, number> = {};
    if (tab === "repuestos") repuestos.forEach((r) => (d[r.id] = r.stock));
    else otros.forEach((o) => (d[o.id] = o.cantidad));
    setDraft(d);
    setRecuento(true);
  }
  function saveRecuento() {
    if (tab === "repuestos")
      setRepuestos((p) =>
        p.map((r) => ({ ...r, stock: draft[r.id] ?? r.stock })),
      );
    else
      setOtros((p) =>
        p.map((o) => ({ ...o, cantidad: draft[o.id] ?? o.cantidad })),
      );
    setRecuento(false);
  }

  return (
    <Section
      title="Inventario"
    >
      <div className="space-y-5">
        <InventarioValor
          equipos={equipos}
          repuestos={repuestos}
          otros={otros}
        />

        {/* tabs + filtros + acción, todo en la misma fila */}
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={tab}
            onChange={switchTab}
            options={[
              { value: "equipos", label: "Equipos para venta", count: equipos.length },
              { value: "repuestos", label: "Repuestos", count: repuestos.length },
              { value: "otros", label: "Otros", count: otros.length },
            ]}
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tab === "equipos"
                  ? "Buscar por modelo, color o IMEI…"
                  : tab === "repuestos"
                    ? "Buscar por nombre, SKU, modelo o proveedor…"
                    : "Buscar por nombre…"
              }
              className={cn("w-64 pl-9", filterPill)}
            />
          </div>
          <span className="text-sm text-neutral-400">
            {(tab === "equipos"
              ? equiposFiltrados.length
              : tab === "repuestos"
                ? repuestosFiltrados.length
                : otrosFiltrados.length)}{" "}
            {tab === "otros" ? "productos" : tab === "repuestos" ? "repuestos" : "equipos"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {(tab === "repuestos" || tab === "otros") &&
              (recuento ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRecuento(false)}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={saveRecuento}>
                    Guardar recuento
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={startRecuento}>
                  <ClipboardCheck className="h-4 w-4" /> Recuento
                </Button>
              ))}
            {!recuento && (
              <button
                onClick={() =>
                  tab === "equipos"
                    ? setAddEquipo(true)
                    : tab === "repuestos"
                      ? setAddRepuesto(true)
                      : setAddOtro(true)
                }
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
              >
                <Plus className="h-4 w-4" />
                {tab === "equipos"
                  ? "Agregar equipo"
                  : tab === "repuestos"
                    ? "Agregar / ingresar repuesto"
                    : "Agregar / ingresar producto"}
              </button>
            )}
          </div>
        </div>

        {/* ── Equipos ───────────────────────────── */}
        {tab === "equipos" && (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                  <th className={cn("px-5 py-3 text-center", thDivider)}>
                    Equipo
                  </th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>
                    Almacenamiento
                  </th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>
                    IMEI
                  </th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>
                    Batería
                  </th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>
                    Condición
                  </th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>
                    Costo
                  </th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>
                    Precio
                  </th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>
                    Margen
                  </th>
                  <th className="px-5 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {equiposFiltrados.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setOpenEquipoId(e.id)}
                    className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                  >
                    <td className="max-w-[160px] truncate px-5 py-2 text-center">
                      <span className="font-medium">{e.modelo}</span>
                      <span className="block truncate text-xs text-neutral-400">
                        {e.color}
                      </span>
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
                    <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                      {fmtUsd(e.costoUsd)}
                    </td>
                    <td className="px-5 py-2 text-center font-semibold tabular-nums">
                      {fmtUsd(e.precioUsd)}
                    </td>
                    <td className="px-5 py-2 text-center tabular-nums text-emerald-600">
                      {(
                        ((e.precioUsd - e.costoUsd) / e.precioUsd) *
                        100
                      ).toFixed(0)}
                      %
                    </td>
                    <td className="px-5 py-2 text-center">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            dotClass[equipoStatus[e.estado].tone],
                          )}
                        />
                        {equipoStatus[e.estado].label}
                      </span>
                    </td>
                  </tr>
                ))}
                {equiposFiltrados.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-10 text-center text-sm text-neutral-400"
                    >
                      Sin equipos para esta búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}

        {/* ── Repuestos ─────────────────────────── */}
        {tab === "repuestos" &&
          (() => {
            const nBajo = repuestos.filter(
              (r) => r.stock > 0 && r.stock <= r.stockMin,
            ).length;
            const nSin = repuestos.filter((r) => r.stock <= 0).length;
            const valor = repuestos.reduce(
              (a, r) => a + r.stock * r.costoUsd,
              0,
            );
            const reponerList = repuestos
              .filter((r) => r.stock <= r.stockMin)
              .sort((a, b) => a.stock / a.stockMin - b.stock / b.stockMin);

            return (
              <>
                <p className="text-sm text-neutral-400">
                  {repuestos.length} repuestos · {nBajo} bajo el mínimo · {nSin}{" "}
                  sin stock
                </p>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard
                    align="left"
                    label="Repuestos"
                    value={repuestos.length}
                    hint="SKUs"
                  />
                  <StatCard
                    align="left"
                    label="Stock bajo"
                    value={nBajo}
                    hint="≤ punto de repo."
                    valueClassName={nBajo ? "text-amber-600" : undefined}
                  />
                  <StatCard
                    align="left"
                    label="Sin stock"
                    value={nSin}
                    hint="reponer ya"
                    valueClassName={nSin ? "text-red-500" : undefined}
                  />
                  <StatCard
                    align="left"
                    label="Valor de stock"
                    value={fmtUsd(valor)}
                    hint="a costo"
                  />
                </div>

                {recuento && (
                  <p className="text-sm text-neutral-500">
                    Ajustá el stock real de cada repuesto y guardá el recuento.
                  </p>
                )}

                <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
                  <Card className="overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                          <th className={cn("px-5 py-3 text-center", thDivider)}>
                            Repuesto
                          </th>
                          <th className={cn("px-5 py-3 text-center", thDivider)}>
                            Modelo
                          </th>
                          <th className={cn("px-5 py-3 text-center", thDivider)}>
                            Stock
                          </th>
                          <th className={cn("px-5 py-3 text-center", thDivider)}>
                            Costo
                          </th>
                          <th className={cn("px-5 py-3 text-center", thDivider)}>
                            Proveedor
                          </th>
                          <th className={cn("px-5 py-3 text-center", thDivider)}>
                            Estado
                          </th>
                          <th className="px-5 py-3" />
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
                              className={cn(
                                "border-t border-neutral-100 first:border-t-0",
                                r.stock <= 0 && "bg-red-50/50",
                                r.stock > 0 &&
                                  r.stock <= r.stockMin &&
                                  "bg-amber-50/40",
                              )}
                            >
                              <td className="max-w-[160px] truncate px-5 py-2 text-center">
                                <span className="font-medium">{r.nombre}</span>
                                <span className="block truncate text-xs text-neutral-400">
                                  {r.sku}
                                </span>
                              </td>
                              <td className="max-w-[120px] truncate px-5 py-2 text-center text-neutral-500">
                                {r.modelo}
                              </td>
                              <td className="px-5 py-2 text-center">
                                {recuento ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    value={draft[r.id] ?? r.stock}
                                    onChange={(e) =>
                                      setDraft((d) => ({
                                        ...d,
                                        [r.id]: Number(e.target.value) || 0,
                                      }))
                                    }
                                    className="mx-auto h-8 w-20 text-center"
                                  />
                                ) : (
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
                                )}
                              </td>
                              <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                                {fmtUsd(r.costoUsd)}
                              </td>
                              <td className="max-w-[120px] truncate px-5 py-2 text-center text-neutral-500">
                                {r.proveedor}
                              </td>
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
                                  size="sm"
                                  variant={
                                    r.stock <= r.stockMin ? "primary" : "outline"
                                  }
                                  onClick={() => reponer(r.id)}
                                >
                                  {r.stock <= r.stockMin ? "Reponer" : "Ingresar"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                        {repuestosFiltrados.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
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
                    <div className="flex items-baseline justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
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
                                <button
                                  onClick={() => reponer(r.id)}
                                  className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
                                >
                                  Reponer
                                </button>
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
        {tab === "otros" && (
          <>
            {recuento && (
              <p className="text-sm text-neutral-500">
                Ajustá la cantidad real de cada producto y guardá el recuento.
              </p>
            )}
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      Producto
                    </th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      Categoría
                    </th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      Costo
                    </th>
                    <th className={cn("px-5 py-3 text-center", thDivider)}>
                      Precio
                    </th>
                    <th className="px-5 py-3 text-center">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {otrosFiltrados.map((o) => (
                    <tr
                      key={o.id}
                      className="border-t border-neutral-100 first:border-t-0"
                    >
                      <td className="max-w-[180px] truncate px-5 py-2 text-center font-medium">
                        {o.nombre}
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
                      <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                        {fmtUsd(o.costoUsd)}
                      </td>
                      <td className="px-5 py-2 text-center font-semibold tabular-nums">
                        {fmtUsd(o.precioUsd)}
                      </td>
                      <td className="px-5 py-2 text-center font-semibold tabular-nums">
                        {recuento ? (
                          <Input
                            type="number"
                            min={0}
                            value={draft[o.id] ?? o.cantidad}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [o.id]: Number(e.target.value) || 0,
                              }))
                            }
                            className="mx-auto h-8 w-20 text-center"
                          />
                        ) : (
                          o.cantidad
                        )}
                      </td>
                    </tr>
                  ))}
                  {otrosFiltrados.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
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
        )}
      </div>

      {/* Agregar equipo */}
      <EquipoFormDialog
        key={addEquipo ? "e" : "e0"}
        equipo={null}
        open={addEquipo}
        onClose={() => setAddEquipo(false)}
        onSubmit={(e) => {
          setEquipos((p) => [e, ...p]);
          setAddEquipo(false);
        }}
      />

      {/* Ver / editar equipo */}
      <EquipoFormDialog
        key={openEquipoId ?? "none"}
        equipo={openEquipo}
        open={!!openEquipo}
        onClose={() => setOpenEquipoId(null)}
        onSubmit={(e) => {
          setEquipos((p) => p.map((x) => (x.id === e.id ? e : x)));
          setOpenEquipoId(null);
        }}
      />

      {/* Agregar / ingresar repuesto */}
      <IngresoDialog
        key={addRepuesto ? `r-${reponerId ?? "x"}` : "r0"}
        open={addRepuesto}
        onClose={() => {
          setAddRepuesto(false);
          setReponerId(null);
        }}
        titulo="repuesto"
        defaultId={reponerId ?? undefined}
        existentes={repuestos.map((r) => ({
          id: r.id,
          label: `${r.nombre} · ${r.modelo}`,
        }))}
        onIngreso={(id, cantidad, precio) => {
          setRepuestos((p) =>
            p.map((r) =>
              r.id === id
                ? { ...r, stock: r.stock + cantidad, costoUsd: precio }
                : r,
            ),
          );
          setAddRepuesto(false);
          setReponerId(null);
        }}
        onNuevo={(nombre, precioCompra, cantidad) => {
          setRepuestos((p) => [
            {
              id: `r-${rid()}`,
              sku: "—",
              nombre,
              modelo: "—",
              stock: cantidad,
              stockMin: 2,
              costoUsd: precioCompra,
              proveedor: "—",
            },
            ...p,
          ]);
          setAddRepuesto(false);
          setReponerId(null);
        }}
      />

      {/* Agregar / ingresar otro producto */}
      <IngresoDialog
        key={addOtro ? "o" : "o0"}
        open={addOtro}
        onClose={() => setAddOtro(false)}
        titulo="producto"
        categoria
        existentes={otros.map((o) => ({ id: o.id, label: o.nombre }))}
        onIngreso={(id, cantidad, precio) => {
          setOtros((p) =>
            p.map((o) =>
              o.id === id
                ? { ...o, cantidad: o.cantidad + cantidad, costoUsd: precio }
                : o,
            ),
          );
          setAddOtro(false);
        }}
        onNuevo={(nombre, precioCompra, cantidad, cat) => {
          setOtros((p) => [
            {
              id: `o-${rid()}`,
              nombre,
              categoria: cat ?? "otro",
              cantidad,
              costoUsd: precioCompra,
              precioUsd: Math.round(precioCompra * 1.3),
            },
            ...p,
          ]);
          setAddOtro(false);
        }}
      />
    </Section>
  );
}

// ─────────────────────────── Dialogs ───────────────────────────

const ESTADOS: EquipoStatus[] = [
  "en_revision",
  "aprobado_para_venta",
  "disponible",
  "vendido",
];

function EquipoFormDialog({
  equipo,
  open,
  onClose,
  onSubmit,
}: {
  equipo: Equipo | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (e: Equipo) => void;
}) {
  const edit = !!equipo;
  const [f, setF] = useState<Equipo>(
    equipo ?? {
      id: "",
      modelo: "",
      almacenamiento: "128GB",
      color: "",
      imei: "",
      bateria: 100,
      condicion: "Muy bueno",
      costoUsd: 0,
      precioUsd: 0,
      estado: "en_revision",
    },
  );
  const set = <K extends keyof Equipo>(k: K, v: Equipo[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const valid = f.modelo.trim() && f.costoUsd > 0 && f.precioUsd > 0;
  const margen =
    f.precioUsd > 0 ? ((f.precioUsd - f.costoUsd) / f.precioUsd) * 100 : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={edit ? `Equipo · ${equipo!.modelo}` : "Agregar equipo"}
      description={
        edit ? `Margen ${margen.toFixed(0)}%` : "Ingresa en estado «En revisión»."
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!valid}
            onClick={() =>
              onSubmit({
                ...f,
                id: f.id || `e-${rid()}`,
                modelo: f.modelo.trim(),
                color: f.color.trim() || "—",
                imei: f.imei.trim() || "—",
              })
            }
          >
            {edit ? "Guardar" : "Agregar"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Modelo">
          <Input
            value={f.modelo}
            onChange={(e) => set("modelo", e.target.value)}
            placeholder="iPhone 13"
          />
        </Field>
        <Field label="Almacenamiento">
          <Select
            value={f.almacenamiento}
            onChange={(e) => set("almacenamiento", e.target.value)}
          >
            {["64GB", "128GB", "256GB", "512GB", "1TB"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="Color">
          <Input value={f.color} onChange={(e) => set("color", e.target.value)} />
        </Field>
        <Field label="IMEI">
          <Input value={f.imei} onChange={(e) => set("imei", e.target.value)} />
        </Field>
        <Field label="Batería (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={f.bateria}
            onChange={(e) => set("bateria", Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Condición">
          <Select
            value={f.condicion}
            onChange={(e) => set("condicion", e.target.value)}
          >
            {["Sellado", "Excelente", "Muy bueno", "Bueno", "Regular"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Costo (U$)">
          <Input
            type="number"
            min={0}
            value={f.costoUsd || ""}
            onChange={(e) => set("costoUsd", Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Precio venta (U$)">
          <Input
            type="number"
            min={0}
            value={f.precioUsd || ""}
            onChange={(e) => set("precioUsd", Number(e.target.value) || 0)}
          />
        </Field>
        {edit && (
          <Field label="Estado" className="col-span-2">
            <Select
              value={f.estado}
              onChange={(e) => set("estado", e.target.value as EquipoStatus)}
            >
              {ESTADOS.map((s) => (
                <option key={s} value={s}>
                  {equipoStatus[s].label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Dialog>
  );
}

function IngresoDialog({
  open,
  onClose,
  titulo,
  categoria,
  defaultId,
  existentes,
  onIngreso,
  onNuevo,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  categoria?: boolean;
  defaultId?: string;
  existentes: { id: string; label: string }[];
  onIngreso: (id: string, cantidad: number, precioCompra: number) => void;
  onNuevo: (
    nombre: string,
    precioCompra: number,
    cantidad: number,
    cat?: OtroCategoria,
  ) => void;
}) {
  const [modo, setModo] = useState<"nuevo" | "existente">(
    existentes.length ? "existente" : "nuevo",
  );
  const [sel, setSel] = useState(defaultId ?? existentes[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [cat, setCat] = useState<OtroCategoria>("accesorio");
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState(0);

  const valid =
    cantidad > 0 &&
    precio > 0 &&
    (modo === "existente" ? !!sel : !!nombre.trim());

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Agregar / ingresar ${titulo}`}
      description="Sumá unidades a un ítem existente o creá uno nuevo."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!valid}
            onClick={() =>
              modo === "existente"
                ? onIngreso(sel, cantidad, precio)
                : onNuevo(
                    nombre.trim(),
                    precio,
                    cantidad,
                    categoria ? cat : undefined,
                  )
            }
          >
            {modo === "existente" ? "Ingresar stock" : "Crear"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
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

        {modo === "existente" ? (
          <Field label={titulo}>
            <Select value={sel} onChange={(e) => setSel(e.target.value)}>
              {existentes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>
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
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
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
      </div>
    </Dialog>
  );
}
