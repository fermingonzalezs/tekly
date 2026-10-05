"use client";

import { Button, IconButton } from "@/components/ui/button";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { SeccionTabla } from "@/components/ui/seccion-tabla";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import {
  GraficoBarrasAgrupadas,
  GraficoRanking,
} from "@/components/seccion/graficos";
import { ClientePicker } from "@/components/ui/cliente-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { dotClass } from "@/lib/status";
import { fmtUsd } from "@/lib/format";
import {
  cargosPagosPorMes,
  deudaPorCliente,
  saldoDe,
} from "@/lib/cuentas-corrientes";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import type { ClienteOpcion, ClienteSeleccion, MovimientoCC } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/types";
import { createMovimientoCCAction, deleteMovimientoCCAction } from "./actions";

/** Grilla de la tabla de movimientos -- columna extra al final solo si hay
 * botón de eliminar (admin), para que header y filas queden alineados. */
function movRowCols(esAdmin: boolean) {
  return esAdmin ? "grid-cols-[110px_1fr_100px_100px_28px]" : "grid-cols-[110px_1fr_100px_100px]";
}

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
  user,
}: {
  initialMovimientos: MovimientoCC[];
  clientes: ClienteOpcion[];
  usuarioNombre: string;
  user: SessionUser;
}) {
  const { publish } = useRealtime();
  const esAdmin = user.rol === "admin";
  const [, startDeleteTransition] = useTransition();
  const [movimientos, setMovimientos] = useState<MovimientoCC[]>(initialMovimientos);
  const [q, setQ] = useState("");
  const [openClienteId, setOpenClienteId] = useState<string | null>(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [nuevoDefault, setNuevoDefault] = useState<{
    clienteId?: string;
    tipo?: "cargo" | "pago";
  } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const movAEliminar = movimientos.find((m) => m.id === confirmDeleteId) ?? null;
  const searchParams = useSearchParams();
  const router = useRouter();

  // ?accion=registrar-pago: el buscador global (CommandPalette) navega acá con
  // ese param. Efecto (no useState inicial) para que también funcione estando
  // ya parado en /cuentas-corrientes -- el componente no se remonta en la
  // misma ruta. Sin cliente preseleccionado: el picker arranca vacío.
  useEffect(() => {
    if (searchParams.get("accion") !== "registrar-pago") return;
    setNuevoDefault({ tipo: "pago" });
    setNuevoOpen(true);
    router.replace("/cuentas-corrientes"); // limpia el param -- evita reabrir con back/refresh
  }, [searchParams, router]);

  const addMovimiento = (mov: MovimientoCC) => {
    setMovimientos((prev) => [mov, ...prev]);
  };

  function eliminarMovimiento(id: string) {
    const m = movimientos.find((x) => x.id === id);
    setMovimientos((prev) => prev.filter((m) => m.id !== id));
    setConfirmDeleteId(null);
    startDeleteTransition(async () => {
      await deleteMovimientoCCAction(id);
    });
    if (m) {
      publish({
        type: "item_deleted",
        actor: user.nombre,
        entity: "Movimiento CC",
        label: `${m.concepto} · ${openRow?.cliente.nombre ?? ""}`,
      });
    }
  }

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

  // Los gráficos respetan el buscador: solo los movimientos de las cuentas
  // visibles. La agrupación vive en `lib/cuentas-corrientes.ts` (pura).
  const movimientosVisibles = useMemo(() => {
    const ids = new Set(cuentas.map((r) => r.cliente.id));
    return movimientos.filter((m) => ids.has(m.clienteId));
  }, [movimientos, cuentas]);

  const rankingDeuda = useMemo(
    () => deudaPorCliente(movimientosVisibles, clientes),
    [movimientosVisibles, clientes],
  );

  const porMes = useMemo(
    () => cargosPagosPorMes(movimientosVisibles),
    [movimientosVisibles],
  );

  return (
    <SeccionTabla
      id="cuentas-corrientes"
      graficos={
        <>
          <GraficoRanking
            title="Deuda por cliente"
            sub="Top 8 por saldo pendiente"
            rows={rankingDeuda.map((r) => ({ label: r.nombre, value: r.saldo }))}
            fmt={fmtUsd}
            vacio="Sin deudas pendientes."
          />
          <GraficoBarrasAgrupadas
            title="Cargos vs pagos por mes"
            sub="Movimientos visibles"
            labels={porMes.labels}
            series={[
              { name: "Cargos", values: porMes.cargos },
              { name: "Pagos", values: porMes.pagos },
            ]}
            fmt={fmtUsd}
            vacio="Sin movimientos."
          />
        </>
      }
      tarjetas={
        <>
          <StatCard
            align="left"
            label="Clientes con deuda"
            value={conDeuda.length}
            hint="con saldo pendiente"
          />
          <StatCard
            align="left"
            label="Total por cobrar"
            value={fmtUsd(totalPorCobrar)}
            valueClassName={totalPorCobrar > 0 ? "text-red-500" : undefined}
            hint="saldo pendiente"
          />
          <StatCard
            align="left"
            label="Cobrado (histórico)"
            value={fmtUsd(totalCobrado)}
            hint="pagos registrados"
          />
          <StatCard align="left" label="Cuentas al día" value={alDia} hint="saldo cero" />
        </>
      }
      filtros={
        <BarraFiltros
          busqueda={
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar cliente por nombre o teléfono…"
                className={cn("w-full pl-9", filterPill)}
                aria-label="Buscar cuentas corrientes"
              />
            </div>
          }
          accion={
            <Button icon={Plus}
              onClick={() => {
                setNuevoDefault(null);
                setNuevoOpen(true);
              }}
              variant="tonal" fullOnMobile
            >
              Nuevo movimiento
            </Button>
          }
        />
      }
    >
      <div className="space-y-2 md:hidden">
        {cuentas.map((r) => (
          <Card
            key={r.cliente.id}
            onClick={() => setOpenClienteId(r.cliente.id)}
            className="cursor-pointer overflow-hidden p-0"
          >
            <div className="bg-table-header px-4 py-2 text-white">
              <p className="truncate text-sm font-semibold">{r.cliente.nombre}</p>
            </div>
            <div className="flex items-stretch gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-neutral-500">{r.cliente.telefono}</p>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 text-[11px] text-neutral-500">
                  <span>{r.movs.length} movimientos</span>
                  <span>{r.ultimo ? `${r.ultimo.fecha} · ${r.ultimo.hora}` : "—"}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center border-l border-neutral-100 pl-3">
                <p
                  className={cn(
                    "text-base font-semibold tabular-nums",
                    r.saldo > 0
                      ? "text-red-500"
                      : r.saldo < 0
                        ? "text-emerald-600"
                        : "text-neutral-500",
                  )}
                >
                  {r.saldo === 0
                    ? "Al día"
                    : `${r.saldo > 0 ? "" : "+"}${fmtUsd(Math.abs(r.saldo))}`}
                </p>
              </div>
            </div>
          </Card>
        ))}
        {cuentas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
            Sin clientes para esta búsqueda.
          </p>
        )}
      </div>

      <Card className="hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-500">
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
                <td className="px-5 py-2 text-center text-neutral-500">
                  {r.ultimo ? `${r.ultimo.fecha} · ${r.ultimo.hora}` : "—"}
                </td>
                <td
                  className={cn(
                    "px-5 py-2 text-center font-semibold tabular-nums",
                    r.saldo > 0
                      ? "text-red-500"
                      : r.saldo < 0
                        ? "text-emerald-600"
                        : "text-neutral-500",
                  )}
                >
                  {r.saldo === 0
                    ? "Al día"
                    : `${r.saldo > 0 ? "" : "+"}${fmtUsd(Math.abs(r.saldo))}`}
                </td>
              </tr>
            ))}
            {cuentas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-500">
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
        size="2xl"
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
              <Button
                onClick={() => setOpenClienteId(null)}
                variant="outline" fullOnMobile
              >
                Cerrar
              </Button>
              <Button
                onClick={() => {
                  setNuevoDefault({ clienteId: openRow.cliente.id, tipo: "pago" });
                  setNuevoOpen(true);
                }}
                variant="primary" fullOnMobile
              >
                Registrar pago
              </Button>
            </>
          )
        }
      >
        {openRow && (
          <div>
            <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Movimientos
            </p>

            <Card className="divide-y divide-neutral-100 overflow-hidden md:hidden">
              {openRow.movs.length === 0 ? (
                <p className="px-4 py-3 text-center text-[13px] text-neutral-500">
                  Sin movimientos registrados.
                </p>
              ) : (
                openRow.movs.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-800">{m.concepto}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            m.tipo === "cargo" ? dotClass.red : dotClass.green,
                          )}
                        />
                        {m.tipo === "cargo" ? "Cargo" : "Pago"} · {m.fecha} · {m.hora}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        m.tipo === "cargo" ? "text-red-500" : "text-emerald-600",
                      )}
                    >
                      {m.tipo === "cargo" ? "+" : "−"}
                      {fmtUsd(m.montoUsd)}
                    </span>
                    {esAdmin && (
                      <IconButton aria-label="Eliminar movimiento" icon={Trash2} variant="danger-ghost" size="sm" onClick={() => setConfirmDeleteId(m.id)} title="Eliminar movimiento" />
                    )}
                  </div>
                ))
              )}
            </Card>

            <div className="hidden overflow-hidden rounded-xl border border-neutral-200 font-mono md:block">
              <div
                className={cn(
                  "grid items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500",
                  movRowCols(esAdmin),
                )}
              >
                <span>Fecha</span>
                <span className="text-start">Concepto</span>
                <span>Tipo</span>
                <span>Monto</span>
                {esAdmin && <span />}
              </div>
              {openRow.movs.length === 0 ? (
                <p className="px-4 py-3 text-center text-[13px] text-neutral-500">
                  Sin movimientos registrados.
                </p>
              ) : (
                openRow.movs.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "grid items-center gap-2 border-t border-neutral-100 px-4 py-2 text-[12px] first:border-t-0",
                      movRowCols(esAdmin),
                    )}
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
                    {esAdmin && (
                      <IconButton aria-label="Eliminar movimiento" icon={Trash2} variant="danger-ghost" size="sm" onClick={() => setConfirmDeleteId(m.id)} title="Eliminar movimiento" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!movAEliminar}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => eliminarMovimiento(confirmDeleteId!)}
        title="¿Eliminar movimiento?"
        confirmLabel="Eliminar movimiento"
      >
        {movAEliminar &&
          `Se eliminará «${movAEliminar.concepto}» (${fmtUsd(movAEliminar.montoUsd)}). Esta acción no se puede deshacer.`}
      </ConfirmDialog>

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
    </SeccionTabla>
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
      title="Nuevo movimiento"
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
            {pending ? "Registrando…" : "Registrar movimiento"}
          </Button>
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
        <p className="text-[11px] text-neutral-500">
          Se registra como <span className="text-neutral-600">{usuarioNombre}</span>.
        </p>
      </div>
    </Dialog>
  );
}
