"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { ClientePicker } from "@/components/ui/cliente-picker";
import { dotClass } from "@/lib/status";
import { fmtUsd } from "@/lib/format";
import { saldoDe } from "@/lib/cuentas-corrientes";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import type { ClienteOpcion, ClienteSeleccion, MovimientoCC } from "@/lib/types";
import { createMovimientoCCAction } from "./actions";

const MES_IDX: Record<string, number> = Object.fromEntries(
  ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"].map(
    (m, i) => [m, i],
  ),
);
function ts(m: MovimientoCC) {
  const [dd, mon] = m.fecha.split(" ");
  const [hh, mm] = m.hora.split(":").map(Number);
  return new Date(2026, MES_IDX[mon] ?? 0, parseInt(dd, 10), hh, mm).getTime();
}

export function CuentasCorrientesClient({
  initialMovimientos,
  clientes,
  usuarioNombre,
}: {
  initialMovimientos: MovimientoCC[];
  clientes: ClienteOpcion[];
  usuarioNombre: string;
}) {
  const [movimientos, setMovimientos] = useState<MovimientoCC[]>(initialMovimientos);
  const [q, setQ] = useState("");
  const [openClienteId, setOpenClienteId] = useState<string | null>(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [nuevoDefault, setNuevoDefault] = useState<{
    clienteId?: string;
    tipo?: "cargo" | "pago";
  } | null>(null);

  const addMovimiento = (mov: MovimientoCC) => {
    setMovimientos((prev) => [mov, ...prev]);
  };

  const cuentas = useMemo(
    () =>
      clientes
        .map((c) => {
          const movs = movimientos
            .filter((m) => m.clienteId === c.id)
            .sort((a, b) => ts(b) - ts(a));
          return {
            cliente: c,
            movs,
            saldo: saldoDe(movimientos, c.id),
            ultimo: movs[0] ?? null,
          };
        })
        // Un cliente sin movimientos no tiene cuenta corriente que mostrar.
        .filter((r) => r.movs.length > 0)
        .filter(
          (r) =>
            !q.trim() ||
            r.cliente.nombre.toLowerCase().includes(q.trim().toLowerCase()) ||
            r.cliente.telefono.includes(q.trim()),
        )
        .sort((a, b) => b.saldo - a.saldo),
    [movimientos, clientes, q],
  );

  const conDeuda = cuentas.filter((r) => r.saldo > 0);
  const totalPorCobrar = conDeuda.reduce((a, r) => a + r.saldo, 0);
  const totalCobrado = movimientos
    .filter((m) => m.tipo === "pago")
    .reduce((a, m) => a + m.montoUsd, 0);
  const alDia = cuentas.filter((r) => r.saldo === 0).length;

  const openRow = cuentas.find((r) => r.cliente.id === openClienteId) ?? null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard align="left" label="Clientes con deuda" value={conDeuda.length} />
        <StatCard
          align="left"
          label="Total por cobrar"
          value={fmtUsd(totalPorCobrar)}
          valueClassName={totalPorCobrar > 0 ? "text-red-500" : undefined}
        />
        <StatCard align="left" label="Cobrado (histórico)" value={fmtUsd(totalCobrado)} />
        <StatCard align="left" label="Cuentas al día" value={alDia} />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente por nombre o teléfono…"
            className={cn("w-72 pl-9", filterPill)}
          />
        </div>
        <button
          onClick={() => {
            setNuevoDefault(null);
            setNuevoOpen(true);
          }}
          className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
        >
          <Plus className="h-4 w-4" />
          Nuevo movimiento
        </button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-400">
              <th className={cn("px-5 py-3 text-center", thDivider)}>Cliente</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Teléfono</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Movimientos</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Último movimiento</th>
              <th className="px-5 py-3 text-center">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map((r) => (
              <tr
                key={r.cliente.id}
                onClick={() => setOpenClienteId(r.cliente.id)}
                className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
              >
                <td className="max-w-[160px] truncate px-5 py-2 text-center font-medium">
                  {r.cliente.nombre}
                </td>
                <td className="px-5 py-2 text-center text-neutral-500">{r.cliente.telefono}</td>
                <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                  {r.movs.length}
                </td>
                <td className="px-5 py-2 text-center text-neutral-400">
                  {r.ultimo ? `${r.ultimo.fecha} · ${r.ultimo.hora}` : "—"}
                </td>
                <td
                  className={cn(
                    "px-5 py-2 text-center font-semibold tabular-nums",
                    r.saldo > 0
                      ? "text-red-500"
                      : r.saldo < 0
                        ? "text-emerald-600"
                        : "text-neutral-400",
                  )}
                >
                  {r.saldo === 0
                    ? "Al día"
                    : `${r.saldo > 0 ? "" : "+"}${fmtUsd(Math.abs(r.saldo))}${r.saldo < 0 ? " a favor" : ""}`}
                </td>
              </tr>
            ))}
            {cuentas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-400">
                  Sin clientes para esta búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog
        open={!!openRow}
        onClose={() => setOpenClienteId(null)}
        size="lg"
        accent
        title={openRow?.cliente.nombre ?? ""}
        description={
          openRow
            ? openRow.saldo === 0
              ? "Cuenta al día"
              : openRow.saldo > 0
                ? `Debe ${fmtUsd(openRow.saldo)}`
                : `A favor ${fmtUsd(-openRow.saldo)}`
            : ""
        }
        footer={
          openRow && (
            <>
              <button
                onClick={() => setOpenClienteId(null)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  setNuevoDefault({ clienteId: openRow.cliente.id, tipo: "pago" });
                  setNuevoOpen(true);
                }}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
              >
                Registrar pago
              </button>
            </>
          )
        }
      >
        {openRow && (
          <div>
            <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Movimientos
            </p>
            <div className="overflow-hidden rounded-xl border border-neutral-200 font-mono">
              <div className="grid grid-cols-[110px_1fr_100px_100px] gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                <span>Fecha</span>
                <span className="text-start">Concepto</span>
                <span>Tipo</span>
                <span>Monto</span>
              </div>
              {openRow.movs.length === 0 ? (
                <p className="px-4 py-3 text-center text-[13px] text-neutral-400">
                  Sin movimientos registrados.
                </p>
              ) : (
                openRow.movs.map((m) => (
                  <div
                    key={m.id}
                    className="grid grid-cols-[110px_1fr_100px_100px] items-center gap-2 border-t border-neutral-100 px-4 py-2 text-[12px] first:border-t-0"
                  >
                    <span className="text-center text-neutral-500">
                      {m.fecha} · {m.hora}
                    </span>
                    <span className="truncate text-start text-neutral-800">{m.concepto}</span>
                    <span className="flex items-center justify-center gap-1.5 text-neutral-700">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          m.tipo === "cargo" ? dotClass.red : dotClass.green,
                        )}
                      />
                      {m.tipo === "cargo" ? "Cargo" : "Pago"}
                    </span>
                    <span
                      className={cn(
                        "text-end font-semibold tabular-nums",
                        m.tipo === "cargo" ? "text-red-500" : "text-emerald-600",
                      )}
                    >
                      {m.tipo === "cargo" ? "+" : "−"}
                      {fmtUsd(m.montoUsd)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Dialog>

      <NuevoMovimientoCCDialog
        key={nuevoOpen ? "n" : "n0"}
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        onCreate={addMovimiento}
        clientes={clientes}
        usuarioNombre={usuarioNombre}
        defaultClienteId={nuevoDefault?.clienteId}
        defaultTipo={nuevoDefault?.tipo}
      />
    </div>
  );
}

function NuevoMovimientoCCDialog({
  open,
  onClose,
  onCreate,
  clientes,
  usuarioNombre,
  defaultClienteId,
  defaultTipo,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (mov: MovimientoCC) => void;
  clientes: ClienteOpcion[];
  usuarioNombre: string;
  defaultClienteId?: string;
  defaultTipo?: "cargo" | "pago";
}) {
  const [cliente, setCliente] = useState<ClienteSeleccion | null>(() => {
    const c = defaultClienteId ? clientes.find((x) => x.id === defaultClienteId) : undefined;
    return c ? { tipo: "existente", id: c.id, nombre: c.nombre } : null;
  });
  const [tipo, setTipo] = useState<"cargo" | "pago">(defaultTipo ?? "cargo");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState(0);
  const [pending, startTransition] = useTransition();

  const valid = !!cliente && !!concepto.trim() && monto > 0;

  const submit = () => {
    if (!cliente || cliente.tipo === "libre") return;
    startTransition(async () => {
      const mov = await createMovimientoCCAction({
        cliente,
        tipo,
        concepto: concepto.trim(),
        montoUsd: monto,
      });
      onCreate(mov);
      onClose();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      accent
      title="Nuevo movimiento"
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
            {pending ? "Registrando…" : "Registrar movimiento"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Cliente">
          <ClientePicker clientes={clientes} value={cliente} onChange={setCliente} />
        </Field>
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as "cargo" | "pago")}>
            <option value="cargo">Cargo (aumenta la deuda)</option>
            <option value="pago">Pago (reduce la deuda)</option>
          </Select>
        </Field>
        <Field label="Concepto">
          <Input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Ej. iPhone 13 128GB a cuenta"
          />
        </Field>
        <Field label="Monto (USD)">
          <Input
            type="number"
            min={0}
            value={monto || ""}
            onChange={(e) => setMonto(Number(e.target.value))}
            placeholder="0"
          />
        </Field>
        <p className="text-[11px] text-neutral-400">
          Se registra como <span className="text-neutral-600">{usuarioNombre}</span>.
        </p>
      </div>
    </Dialog>
  );
}
