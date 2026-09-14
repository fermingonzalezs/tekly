"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { medioPago as medioPagoCfg, compraEstado, dotClass } from "@/lib/status";
import { fmtUsd, fmtArs } from "@/lib/format";
import { useDolar } from "@/lib/dolar";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import type { Compra, CompraEstado, CompraItem, MedioPago } from "@/lib/types";
import { createCompraAction, marcarRecibidaAction } from "./actions";

const MEDIOS: MedioPago[] = ["pesos", "dolares", "transferencia", "cripto", "tarjeta", "canje"];

function matchesQuery(c: Compra, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (c.proveedor.toLowerCase().includes(needle)) return true;
  return c.items.some((i) => i.detalle.toLowerCase().includes(needle));
}

export function ComprasClient({ initialCompras }: { initialCompras: Compra[] }) {
  const [list, setList] = useState<Compra[]>(initialCompras);
  const [estadoFiltro, setEstadoFiltro] = useState<"todos" | CompraEstado>("todos");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      list.filter(
        (c) => (estadoFiltro === "todos" || c.estado === estadoFiltro) && matchesQuery(c, q),
      ),
    [list, estadoFiltro, q],
  );

  const open = list.find((c) => c.id === openId) ?? null;
  const totalUsd = filtered.reduce((a, c) => a + c.totalUsd, 0);
  const pendientes = filtered.filter((c) => c.estado === "pendiente").length;

  function marcarRecibida(id: string) {
    startTransition(async () => {
      const actualizada = await marcarRecibidaAction(id);
      setList((prev) => prev.map((c) => (c.id === id ? actualizada : c)));
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard align="left" label="Compras" value={filtered.length} />
        <StatCard align="left" label="Gastado (USD)" value={fmtUsd(totalUsd)} />
        <StatCard align="left" label="Pendientes de recepción" value={pendientes} />
        <StatCard
          align="left"
          label="Ticket promedio"
          value={fmtUsd(filtered.length ? totalUsd / filtered.length : 0)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por proveedor o ítem…"
            className={cn("w-64 pl-9", filterPill)}
          />
        </div>
        <Select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as "todos" | CompraEstado)}
          className={cn("w-44", filterPill)}
        >
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="recibida">Recibida</option>
        </Select>
        <button
          onClick={() => setCreating(true)}
          className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
        >
          <Plus className="h-4 w-4" />
          Nueva compra
        </button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-400">
              <th className={cn("px-5 py-3 text-center", thDivider)}>Compra</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Proveedor</th>
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
                <td className="px-5 py-2 text-center font-medium">{c.proveedor}</td>
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
                  {c.medioPago === "pesos" && c.montoArs != null && (
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
        size="lg"
        accent
        title={open?.id ?? ""}
        description={open ? `${open.fecha} · ${open.proveedor}` : ""}
        footer={
          open && (
            <>
              <button
                onClick={() => setOpenId(null)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                Cerrar
              </button>
              {open.estado === "pendiente" && (
                <button
                  disabled={pending}
                  onClick={() => {
                    marcarRecibida(open.id);
                    setOpenId(null);
                  }}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                >
                  Marcar como recibida
                </button>
              )}
            </>
          )
        }
      >
        {open && <CompraDetalle compra={open} />}
      </Dialog>

      <NuevaCompraDialog
        key={creating ? "n" : "n0"}
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(c) => {
          setList((prev) => [c, ...prev]);
          setCreating(false);
        }}
      />
    </div>
  );
}

function CompraDetalle({ compra }: { compra: Compra }) {
  const metaFields = [
    { label: "Proveedor", value: compra.proveedor },
    { label: "Fecha", value: compra.fecha },
    { label: "Medio de pago", value: medioPagoCfg[compra.medioPago].label },
    { label: "Estado", value: compraEstado[compra.estado].label },
    ...(compra.medioPago === "pesos" && compra.montoArs != null
      ? [
          { label: "Monto pagado", value: fmtArs(compra.montoArs) },
          { label: "Cotización", value: fmtArs(compra.cotizacion ?? 0) },
        ]
      : []),
  ];
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Información general
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metaFields.map((f) => (
            <Card key={f.label} className="p-3 text-center">
              <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {f.label}
              </p>
              <p className="mt-2 truncate text-sm font-normal text-neutral-600">{f.value}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Ítems
        </p>
        <div className="overflow-hidden rounded-xl border border-neutral-200">
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
                style={{ backgroundColor: "#edecf8", backgroundImage: "none" }}
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
    </div>
  );
}

function NuevaCompraDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (c: Compra) => void;
}) {
  const [proveedor, setProveedor] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago>("transferencia");
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
        ...(medioPago === "pesos"
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
      size="lg"
      accent
      title="Nueva compra"
      description="Se asigna un número al confirmar"
      footer={
        <>
          <button
            onClick={onClose}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            disabled={!valid || pending}
            onClick={submit}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Registrando…" : "Registrar compra"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Proveedor">
            <Input
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Ej. Tecno Import"
            />
          </Field>
          <Field label="Medio de pago">
            <Select value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)}>
              {MEDIOS.map((m) => (
                <option key={m} value={m}>
                  {medioPagoCfg[m].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
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
          <button
            onClick={() => setItems((prev) => [...prev, { detalle: "", cantidad: 1, costoUsd: 0 }])}
            className="mt-2 flex items-center gap-1.5 rounded-full border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar ítem
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
          <span className="font-medium text-neutral-500">Total</span>
          <span className="text-end">
            <span className="block font-semibold tabular-nums">{fmtUsd(total)}</span>
            {medioPago === "pesos" && (
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
