"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Check, FileText } from "lucide-react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import {
  ReciboDialog,
  ReciboCampos,
  ReciboLineas,
} from "@/components/recibos/recibo";
import { medioPago as medioPagoCfg } from "@/lib/status";
import {
  ventas as seed,
  vendedores,
  clientes,
  equipos,
  otros,
  servicios,
} from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";
import { publish } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import type { MedioPago, Pago, Venta, VentaItem } from "@/lib/types";

const MEDIOS: MedioPago[] = [
  "pesos",
  "dolares",
  "transferencia",
  "cripto",
  "tarjeta",
  "canje",
];

const PROCEDENCIAS = [
  "Local",
  "WhatsApp",
  "Instagram",
  "MercadoLibre",
  "Referido",
  "Otro",
];

export default function VentasPage() {
  const [list, setList] = useState<Venta[]>(seed);
  const [vendFilter, setVendFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState<"todos" | "venta" | "reparacion">(
    "todos",
  );
  const [desde, setDesde] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [recibo, setRecibo] = useState<{
    venta: Venta;
    tipo: "venta" | "canje";
  } | null>(null);

  const filtered = useMemo(
    () =>
      list.filter(
        (v) =>
          (vendFilter === "todos" || v.vendedor === vendFilter) &&
          (tipoFilter === "todos" || v.tipo === tipoFilter) &&
          (!desde || v.fechaISO >= desde),
      ),
    [list, vendFilter, tipoFilter, desde],
  );

  const open = list.find((v) => v.id === openId) ?? null;

  const totalUsd = filtered.reduce((a, v) => a + v.totalUsd, 0);
  const margenProm =
    filtered.length > 0
      ? filtered.reduce((a, v) => a + v.margenPct, 0) / filtered.length
      : 0;

  return (
    <Section title="Ventas">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Operaciones" value={filtered.length} />
          <StatCard label="Facturado" value={fmtUsd(totalUsd)} />
          <StatCard label="Margen promedio" value={`${margenProm.toFixed(1)}%`} />
          <StatCard
            label="Ticket promedio"
            value={fmtUsd(filtered.length ? totalUsd / filtered.length : 0)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={vendFilter}
            onChange={(e) => setVendFilter(e.target.value)}
            className="w-44"
          >
            <option value="todos">Todos los vendedores</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.alias}>
                {v.alias}
              </option>
            ))}
          </Select>
          <Select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value as typeof tipoFilter)}
            className="w-40"
          >
            <option value="todos">Todo</option>
            <option value="venta">Equipos</option>
            <option value="reparacion">Reparaciones</option>
          </Select>
          <Input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="w-40"
          />
          {desde && (
            <button
              onClick={() => setDesde("")}
              className="text-xs text-neutral-400 hover:text-neutral-600"
            >
              limpiar fecha
            </button>
          )}
          <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nueva venta
          </Button>
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                <th className="px-5 py-3">Venta</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Detalle</th>
                <th className="px-5 py-3">Vendedor</th>
                <th className="px-5 py-3">Pago</th>
                <th className="px-5 py-3">Margen</th>
                <th className="px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => setOpenId(v.id)}
                  className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                >
                  <td className="px-5 py-3 font-medium text-neutral-500">
                    {v.id}
                    <span className="block text-xs font-normal text-neutral-400">
                      {v.fecha}
                    </span>
                  </td>
                  <td className="px-5 py-3">{v.cliente}</td>
                  <td className="px-5 py-3 text-start text-neutral-500">
                    {v.items.map((i) => i.detalle).join(" · ")}
                  </td>
                  <td className="px-5 py-3">{v.vendedor}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap justify-center gap-1">
                      {v.pagos.map((p, i) => (
                        <Badge key={i} tone={medioPagoCfg[p.medio].tone}>
                          {medioPagoCfg[p.medio].label}
                          {v.pagos.length > 1 && (
                            <span className="opacity-60"> {fmtUsd(p.montoUsd)}</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-neutral-500">
                    {v.margenPct.toFixed(1)}%
                  </td>
                  <td className="px-5 py-3 font-semibold">{fmtUsd(v.totalUsd)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-neutral-400"
                  >
                    Sin ventas para estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <NuevaVentaDialog
        key={creating ? "abierto" : "cerrado"}
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(v) => {
          setList((prev) => [v, ...prev]);
          setCreating(false);
          publish({
            type: "sale_confirmed",
            actor: `${v.vendedor} (ventas)`,
            amountUsd: v.totalUsd,
            ref: v.id,
          });
        }}
        nextRef={`V-${4822 + (list.length - seed.length)}`}
      />

      <Dialog
        open={!!open}
        onClose={() => setOpenId(null)}
        size="lg"
        title={open ? `Venta ${open.id}` : ""}
        description={open ? open.fecha : ""}
        footer={
          open && (
            <>
              <Button variant="outline" size="sm" onClick={() => setOpenId(null)}>
                Cerrar
              </Button>
              {open.pagos.some((p) => p.medio === "canje") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRecibo({ venta: open, tipo: "canje" })}
                >
                  <FileText className="h-4 w-4" /> Recibo de canje
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setRecibo({ venta: open, tipo: "venta" })}
              >
                <FileText className="h-4 w-4" /> Comprobante de venta
              </Button>
            </>
          )
        }
      >
        {open && <VentaDetalle venta={open} />}
      </Dialog>

      <ReciboDialog
        key={recibo ? `${recibo.tipo}-${recibo.venta.id}` : "none"}
        open={!!recibo}
        onClose={() => setRecibo(null)}
        titulo={
          recibo?.tipo === "canje"
            ? "Recibo de equipo en parte de pago"
            : "Comprobante de venta"
        }
        nro={recibo?.venta.id ?? ""}
        fecha={recibo?.venta.fecha ?? ""}
      >
        {recibo?.tipo === "venta" && (
          <>
            <ReciboCampos
              filas={[
                ["Cliente", recibo.venta.cliente],
                ["Vendedor", recibo.venta.vendedor],
                ["Procedencia", recibo.venta.procedencia ?? "—"],
              ]}
            />
            <ReciboLineas
              titulo="Detalle"
              lineas={recibo.venta.items.map((i) => ({
                detalle: i.detalle,
                cantidad: i.cantidad,
                montoUsd: i.cantidad * i.precioUsd,
              }))}
              total={recibo.venta.totalUsd}
            />
            <ReciboLineas
              titulo="Forma de pago"
              lineas={recibo.venta.pagos.map((p) => ({
                detalle: medioPagoCfg[p.medio].label,
                montoUsd: p.montoUsd,
              }))}
            />
          </>
        )}
        {recibo?.tipo === "canje" && (
          <>
            <ReciboCampos
              filas={[
                ["Cliente", recibo.venta.cliente],
                ["Aplicado a", `Venta ${recibo.venta.id}`],
                [
                  "Valor reconocido",
                  fmtUsd(
                    recibo.venta.pagos
                      .filter((p) => p.medio === "canje")
                      .reduce((a, p) => a + p.montoUsd, 0),
                  ),
                ],
              ]}
            />
            <div className="mt-5 space-y-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Equipo recibido (completar a mano)
              </p>
              {["Modelo y capacidad", "IMEI / Serie", "Estado y accesorios"].map(
                (l) => (
                  <p
                    key={l}
                    className="border-b border-dashed border-neutral-300 pb-6 text-xs text-neutral-400"
                  >
                    {l}
                  </p>
                ),
              )}
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              El cliente declara ser titular del equipo entregado y que no tiene
              pedido de secuestro ni deudas asociadas.
            </p>
          </>
        )}
      </ReciboDialog>
    </Section>
  );
}

// ────────────────────── Detalle de venta ──────────────────────

function VentaDetalle({ venta }: { venta: Venta }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-neutral-400">Cliente </span>
          <span className="font-medium">{venta.cliente}</span>
        </span>
        <span>
          <span className="text-neutral-400">Vendedor </span>
          <span className="font-medium">{venta.vendedor}</span>
        </span>
        {venta.procedencia && (
          <span>
            <span className="text-neutral-400">Procedencia </span>
            <span className="font-medium">{venta.procedencia}</span>
          </span>
        )}
        <span>
          <span className="text-neutral-400">Tipo </span>
          <span className="font-medium">
            {venta.tipo === "venta" ? "Venta de equipos" : "Reparación / servicio"}
          </span>
        </span>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Ítems
        </p>
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                <th className="px-4 py-2 text-start">Detalle</th>
                <th className="px-4 py-2">Cant</th>
                <th className="px-4 py-2">Precio</th>
                <th className="px-4 py-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {venta.items.map((i, idx) => (
                <tr
                  key={idx}
                  className="border-t border-neutral-100 first:border-t-0"
                >
                  <td className="px-4 py-2.5 text-start">{i.detalle}</td>
                  <td className="px-4 py-2.5 tabular-nums">{i.cantidad}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {fmtUsd(i.precioUsd)}
                  </td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums">
                    {fmtUsd(i.cantidad * i.precioUsd)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-neutral-100 font-semibold">
                <td className="px-4 py-2.5 text-start" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {fmtUsd(venta.totalUsd)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Pago
        </p>
        <div className="rounded-xl border border-neutral-200">
          {venta.pagos.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0"
            >
              <Badge tone={medioPagoCfg[p.medio].tone}>
                {medioPagoCfg[p.medio].label}
              </Badge>
              <span className="font-semibold tabular-nums">
                {fmtUsd(p.montoUsd)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm">
        <span className="text-neutral-400">Margen </span>
        <span className="font-semibold">{venta.margenPct.toFixed(1)}%</span>
      </p>
    </div>
  );
}

// ─────────────────────────── Nueva venta ───────────────────────────

const rid = () => Math.random().toString(36).slice(2);

type Origen = "equipo" | "otro" | "servicio" | "libre";
type DraftItem = VentaItem & { _k: string; origen: Origen };
type DraftPago = Pago & { _k: string };

type CatItem = {
  key: string;
  origen: Exclude<Origen, "libre">;
  refId: string;
  nombre: string;
  costoUsd: number;
  precioUsd: number;
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

function useOutside<T extends HTMLElement>(onOut: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  });
  return ref;
}

function Eyebrow({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {children}
      </p>
      {right}
    </div>
  );
}

// ── Buscador de cliente ─────────────────────────────────────────

function ClienteBuscador({
  onPick,
  onNuevo,
}: {
  onPick: (c: { id: string; nombre: string }) => void;
  onNuevo: (nombre: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(() => setOpen(false));

  const matches = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Buscar cliente por nombre…"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick({ id: c.id, nombre: c.nombre });
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-neutral-50"
            >
              <span className="font-medium">{c.nombre}</span>
              <span className="text-neutral-400">{c.telefono}</span>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-neutral-400">
              Sin coincidencias.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              onNuevo(q.trim());
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2 text-left text-[13px] font-medium text-accent hover:bg-accent-soft"
          >
            <Plus className="h-3.5 w-3.5" />
            Crear cliente nuevo{q.trim() ? `: «${q.trim()}»` : ""}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Buscador de ítems ──────────────────────────────────────────

function ItemBuscador({
  yaAgregados,
  onAdd,
  onLibre,
}: {
  yaAgregados: string[];
  onAdd: (c: CatItem) => void;
  onLibre: (nombre: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(() => setOpen(false));

  const catalogo: CatItem[] = useMemo(
    () => [
      ...equipos
        .filter(
          (e) =>
            e.estado === "disponible" || e.estado === "aprobado_para_venta",
        )
        .map((e) => ({
          key: `e-${e.id}`,
          origen: "equipo" as const,
          refId: e.id,
          nombre: `${e.modelo} ${e.almacenamiento} ${e.color}`,
          costoUsd: e.costoUsd,
          precioUsd: e.precioUsd,
        })),
      ...otros.map((o) => ({
        key: `o-${o.id}`,
        origen: "otro" as const,
        refId: o.id,
        nombre: o.nombre,
        costoUsd: o.costoUsd,
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
    [],
  );

  const matches = catalogo.filter(
    (c) =>
      c.nombre.toLowerCase().includes(q.toLowerCase()) &&
      !(c.origen === "equipo" && yaAgregados.includes(c.refId)),
  );

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Buscar equipo, producto o servicio por nombre…"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
          {matches.slice(0, 8).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                onAdd(c);
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-neutral-50"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Badge tone={origenTone[c.origen]}>{origenLabel[c.origen]}</Badge>
                <span className="truncate">{c.nombre}</span>
              </span>
              <span className="shrink-0 font-semibold text-neutral-500">
                {fmtUsd(c.precioUsd)}
              </span>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-neutral-400">
              Sin coincidencias en el catálogo.
            </p>
          )}
          {q.trim() && (
            <button
              type="button"
              onClick={() => {
                onLibre(q.trim());
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2 text-left text-[13px] font-medium text-accent hover:bg-accent-soft"
            >
              <Plus className="h-3.5 w-3.5" /> Ítem libre: «{q.trim()}»
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
  nextRef,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (v: Venta) => void;
  nextRef: string;
}) {
  const [clienteMode, setClienteMode] = useState<"buscar" | "nuevo">("buscar");
  const [clienteSel, setClienteSel] = useState<{
    id: string;
    nombre: string;
  } | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTel, setNuevoTel] = useState("");

  const [vendedor, setVendedor] = useState(vendedores[0].alias);
  const [procedencia, setProcedencia] = useState(PROCEDENCIAS[0]);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [pagos, setPagos] = useState<DraftPago[]>([
    { _k: rid(), medio: "pesos", montoUsd: 0 },
  ]);

  const totalPrecio = items.reduce((a, i) => a + i.cantidad * i.precioUsd, 0);
  const totalCosto = items.reduce(
    (a, i) => a + i.cantidad * (i.costoUsd ?? 0),
    0,
  );
  const margenPct =
    totalPrecio > 0 ? ((totalPrecio - totalCosto) / totalPrecio) * 100 : 0;

  const pagado = pagos.reduce((a, p) => a + p.montoUsd, 0);
  const restante = Math.round((totalPrecio - pagado) * 100) / 100;

  useEffect(() => {
    setPagos((prev) =>
      prev.length === 1 ? [{ ...prev[0], montoUsd: totalPrecio }] : prev,
    );
  }, [totalPrecio]);

  const clienteNombre =
    clienteMode === "nuevo" ? nuevoNombre.trim() : clienteSel?.nombre ?? "";

  const valid =
    totalPrecio > 0 &&
    items.every((i) => i.detalle.trim() && i.precioUsd > 0) &&
    clienteNombre.length > 0 &&
    pagos.every((p) => p.montoUsd > 0) &&
    Math.abs(restante) < 0.005;

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

  const updPago = (k: string, patch: Partial<DraftPago>) =>
    setPagos((p) => p.map((x) => (x._k === k ? { ...x, ...patch } : x)));
  const rmPago = (k: string) =>
    setPagos((p) => (p.length > 1 ? p.filter((x) => x._k !== k) : p));
  const addPago = () =>
    setPagos((p) => [
      ...p,
      {
        _k: rid(),
        medio:
          MEDIOS.find((m) => !p.some((x) => x.medio === m)) ?? "transferencia",
        montoUsd: restante > 0 ? restante : 0,
      },
    ]);
  const saldar = () =>
    setPagos((p) => {
      if (!p.length) return p;
      const last = p[p.length - 1];
      const monto = Math.max(
        0,
        Math.round((last.montoUsd + restante) * 100) / 100,
      );
      return p.map((x, i) =>
        i === p.length - 1 ? { ...x, montoUsd: monto } : x,
      );
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Nueva venta"
      description={`Referencia ${nextRef}`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!valid}
            onClick={() =>
              onCreate({
                id: nextRef,
                fecha: "Recién",
                fechaISO: "2026-09-07",
                clienteId:
                  clienteMode === "nuevo"
                    ? `c-${rid()}`
                    : clienteSel?.id ?? "c-1",
                cliente: clienteNombre,
                vendedorId:
                  vendedores.find((v) => v.alias === vendedor)?.id ?? "u-2",
                vendedor,
                procedencia,
                items: items.map(({ _k, origen, ...i }) => i),
                totalUsd: totalPrecio,
                pagos: pagos.map(({ _k, ...p }) => p),
                margenPct: Math.round(margenPct * 10) / 10,
                tipo: items.some((i) => i.origen === "equipo")
                  ? "venta"
                  : "reparacion",
              })
            }
          >
            Confirmar venta · {fmtUsd(totalPrecio)}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Cliente */}
        <section>
          <Eyebrow>Cliente</Eyebrow>
          {clienteMode === "buscar" && !clienteSel && (
            <ClienteBuscador
              onPick={setClienteSel}
              onNuevo={(nombre) => {
                setNuevoNombre(nombre);
                setClienteMode("nuevo");
              }}
            />
          )}
          {clienteMode === "buscar" && clienteSel && (
            <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
              <span className="font-medium">{clienteSel.nombre}</span>
              <button
                type="button"
                onClick={() => setClienteSel(null)}
                className="text-xs font-medium text-accent hover:underline"
              >
                cambiar
              </button>
            </div>
          )}
          {clienteMode === "nuevo" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre" labelClassName="text-center">
                  <Input
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    placeholder="Nombre y apellido"
                  />
                </Field>
                <Field label="Teléfono" labelClassName="text-center">
                  <Input
                    value={nuevoTel}
                    onChange={(e) => setNuevoTel(e.target.value)}
                    placeholder="Opcional"
                  />
                </Field>
              </div>
              <button
                type="button"
                onClick={() => {
                  setClienteMode("buscar");
                  setNuevoNombre("");
                }}
                className="text-xs font-medium text-accent hover:underline"
              >
                ← Buscar cliente existente
              </button>
            </div>
          )}
        </section>

        {/* Vendedor + Procedencia */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendedor" labelClassName="text-center">
            <Select
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
            >
              {vendedores.map((v) => (
                <option key={v.id}>{v.alias}</option>
              ))}
            </Select>
          </Field>
          <Field label="Procedencia" labelClassName="text-center">
            <Select
              value={procedencia}
              onChange={(e) => setProcedencia(e.target.value)}
            >
              {PROCEDENCIAS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Ítems */}
        <section>
          <Eyebrow
            right={
              <span className="text-xs text-neutral-400">
                {items.length} ítem{items.length === 1 ? "" : "s"}
              </span>
            }
          >
            Ítems
          </Eyebrow>

          <ItemBuscador
            yaAgregados={items
              .map((i) => i.equipoId)
              .filter((x): x is string => !!x)}
            onAdd={addCatalogo}
            onLibre={addLibre}
          />

          {items.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-center text-[13px] text-neutral-400">
              Buscá arriba cualquier equipo, producto o servicio por su nombre.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                <span className="flex-1">Ítem</span>
                <span className="w-12 text-center">Cant</span>
                <span className="w-24 text-center">Precio</span>
                <span className="w-9" />
              </div>
              {items.map((it) => (
                <div key={it._k} className="flex items-center gap-2">
                  <Input
                    className="min-w-0 flex-1"
                    placeholder="Nombre del ítem"
                    value={it.detalle}
                    readOnly={it.origen !== "libre"}
                    onChange={(e) =>
                      updItem(it._k, { detalle: e.target.value })
                    }
                  />
                  <Input
                    className="w-12 text-center"
                    type="number"
                    min={1}
                    value={it.cantidad}
                    onChange={(e) =>
                      updItem(it._k, { cantidad: Number(e.target.value) || 1 })
                    }
                  />
                  <Input
                    className="w-24"
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
                  <button
                    type="button"
                    onClick={() => rmItem(it._k)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pago */}
        <section>
          <Eyebrow
            right={
              <span className="text-sm font-semibold tabular-nums">
                Total {fmtUsd(totalPrecio)}
                <span className="ml-2 text-xs font-normal text-neutral-400">
                  margen {margenPct.toFixed(0)}%
                </span>
              </span>
            }
          >
            Pago
          </Eyebrow>

          <div className="space-y-2">
            {pagos.map((p) => (
              <div key={p._k} className="flex items-center gap-2">
                <Select
                  value={p.medio}
                  onChange={(e) =>
                    updPago(p._k, { medio: e.target.value as MedioPago })
                  }
                  className="w-40"
                >
                  {MEDIOS.map((m) => (
                    <option key={m} value={m}>
                      {medioPagoCfg[m].label}
                    </option>
                  ))}
                </Select>
                <Input
                  className="flex-1"
                  type="number"
                  min={0}
                  placeholder="U$"
                  value={p.montoUsd || ""}
                  onChange={(e) =>
                    updPago(p._k, { montoUsd: Number(e.target.value) || 0 })
                  }
                />
                <button
                  type="button"
                  onClick={() => rmPago(p._k)}
                  disabled={pagos.length === 1}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={addPago}
              disabled={pagos.length >= MEDIOS.length}
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
                <span
                  className={restante > 0 ? "text-amber-600" : "text-red-500"}
                >
                  {restante > 0 ? "Faltan " : "Sobran "}
                  {fmtUsd(Math.abs(restante))}
                </span>
                <button
                  type="button"
                  onClick={saldar}
                  className="rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  Saldar
                </button>
              </span>
            )}
          </div>
        </section>
      </div>
    </Dialog>
  );
}
