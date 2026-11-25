"use client";

import { useRef, useState } from "react";
import { Check, PackageCheck, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, GrillaCampos, Input, Textarea } from "@/components/ui/field";
import { ClientePicker } from "@/components/ui/cliente-picker";
import { fmtUsd } from "@/lib/format";
import {
  errorPedido,
  itemPedidoVacio,
  limpiarItems,
  normalizarItems,
  redondearUsd,
  saldoPedido,
  subtotalItem,
  totalPedido,
  type PedidoItemBorrador,
} from "@/lib/pedidos";
import { cn } from "@/lib/utils";
import { etiquetaDia, pedidoAbierto, pedidoVencido } from "@/lib/agenda";
import { dotClass, pedidoEstado } from "@/lib/status";
import type {
  ClienteOpcion,
  ClienteSeleccion,
  Pedido,
  PedidoEstado,
} from "@/lib/types";
import type { PedidoInput } from "@/app/(app)/agenda/actions";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
      {children}
    </p>
  );
}

/** Filas del dialog: los ítems guardados o, en un pedido viejo (sin ítems),
 * una fila con el texto que había y el precio vacío (hay que cargarlo antes
 * de guardar — Decisión 7 del plan 028). */
function itemsIniciales(pedido: Pedido | null): PedidoItemBorrador[] {
  if (!pedido) return [itemPedidoVacio()];
  if (pedido.items.length > 0) {
    return pedido.items.map((i) => ({
      detalle: i.detalle,
      cantidad: String(i.cantidad),
      precioUsd: String(i.precioUsd),
    }));
  }
  return [{ detalle: pedido.descripcion, cantidad: "1", precioUsd: "" }];
}

/** Alta / edición de un pedido: cliente, productos con precio, seña, fecha de
 * entrega y nota. Va a la fila «Todo el día» del calendario en su fecha. */
export function PedidoDialog({
  open,
  pedido,
  fechaInicial,
  clientesOpciones,
  error,
  guardando,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** `null` = alta. */
  pedido: Pedido | null;
  fechaInicial: string;
  clientesOpciones: ClienteOpcion[];
  error: string | null;
  guardando: boolean;
  onClose: () => void;
  onSubmit: (data: PedidoInput) => void;
}) {
  const [cliente, setCliente] = useState<ClienteSeleccion | null>(
    pedido
      ? pedido.clienteId
        ? { tipo: "existente", id: pedido.clienteId, nombre: pedido.cliente }
        : { tipo: "libre", nombre: pedido.cliente }
      : null,
  );
  const [items, setItems] = useState<PedidoItemBorrador[]>(() => itemsIniciales(pedido));
  const [fechaEntrega, setFechaEntrega] = useState(pedido?.fechaEntrega ?? fechaInicial);
  const [abonaSena, setAbonaSena] = useState((pedido?.senaUsd ?? 0) > 0);
  const [sena, setSena] = useState(pedido && pedido.senaUsd > 0 ? String(pedido.senaUsd) : "");
  const [nota, setNota] = useState(pedido?.nota ?? "");
  const [tocado, setTocado] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const filas = limpiarItems(items);
  // Vacío en el input de la seña = falta el monto (no 0): así «Abonó seña»
  // sin monto no se guarda como seña cero.
  const senaNum = abonaSena ? (sena.trim() === "" ? Number.NaN : Number(sena)) : 0;
  const total = totalPedido(filas);
  const saldo = saldoPedido(filas, senaNum);
  const errorValidacion = errorPedido({ items: filas, senaUsd: senaNum });

  const valido =
    !!cliente && cliente.nombre.trim() !== "" && !!fechaEntrega && !errorValidacion;

  function cambiarItem(indice: number, cambio: Partial<PedidoItemBorrador>) {
    setTocado(true);
    setItems((xs) => xs.map((x, i) => (i === indice ? { ...x, ...cambio } : x)));
  }

  function agregarItem() {
    const indice = items.length;
    setItems((xs) => [...xs, itemPedidoVacio()]);
    requestAnimationFrame(() => refs.current[indice]?.focus());
  }

  function quitarItem(indice: number) {
    setTocado(true);
    setItems((xs) => xs.filter((_, i) => i !== indice));
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      formulario
      title={pedido ? "Editar pedido" : "Nuevo pedido"}
      description="Aparece en «Todo el día» del calendario, en la fecha de entrega."
      footer={
        <>
          <Button onClick={onClose} variant="outline" fullOnMobile>
            Cancelar
          </Button>
          <Button
            variant="primary"
            fullOnMobile
            loading={guardando}
            disabled={!valido}
            onClick={() =>
              cliente &&
              onSubmit({
                cliente,
                items: normalizarItems(filas),
                // `valido` ya garantizó que `senaNum` es un número finito ≥ 0.
                senaUsd: redondearUsd(senaNum),
                fechaEntrega,
                nota,
              })
            }
          >
            {pedido ? "Guardar cambios" : "Guardar pedido"}
          </Button>
        </>
      }
    >
      <GrillaCampos>
        <Field label="Cliente" className="sm:col-span-2">
          <ClientePicker
            clientes={clientesOpciones}
            value={cliente}
            onChange={(c) => {
              setTocado(true);
              setCliente(c);
            }}
            allowLibre
          />
        </Field>
        <Field label="Fecha de entrega">
          <Input
            type="date"
            value={fechaEntrega}
            onChange={(e) => {
              setTocado(true);
              setFechaEntrega(e.target.value);
            }}
          />
        </Field>
      </GrillaCampos>

      <div className="mt-5">
        <Eyebrow>Productos</Eyebrow>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="text-xs">
                <th>Producto</th>
                <th className="w-20">Cant.</th>
                <th className="w-32">Precio unit. (U$)</th>
                <th className="w-28">Subtotal</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, indice) => (
                <tr key={indice}>
                  <td className="p-1.5 text-start">
                    <Input
                      ref={(el) => {
                        refs.current[indice] = el;
                      }}
                      value={item.detalle}
                      onChange={(e) => cambiarItem(indice, { detalle: e.target.value })}
                      aria-label={`Producto ${indice + 1}`}
                      placeholder="Ej: iPhone 15 Pro 256 GB"
                      className="!h-8 !rounded-lg"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={item.cantidad}
                      onChange={(e) => cambiarItem(indice, { cantidad: e.target.value })}
                      aria-label={`Cantidad del producto ${indice + 1}`}
                      className="!h-8 !rounded-lg !text-center"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={item.precioUsd}
                      onChange={(e) => cambiarItem(indice, { precioUsd: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && indice === items.length - 1) agregarItem();
                      }}
                      aria-label={`Precio unitario del producto ${indice + 1}`}
                      placeholder="0"
                      className="!h-8 !rounded-lg !text-center"
                    />
                  </td>
                  <td className="p-1.5 text-center tabular-nums text-neutral-900">
                    {fmtUsd(subtotalItem(item))}
                  </td>
                  <td className="p-1.5 text-center">
                    <IconButton
                      icon={Trash2}
                      aria-label="Quitar producto"
                      variant="danger-ghost"
                      size="sm"
                      shape="square"
                      disabled={items.length === 1}
                      onClick={() => quitarItem(indice)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          variant="tonal"
          icon={Plus}
          size="sm"
          className="mt-2"
          onClick={agregarItem}
        >
          Agregar producto
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        <Eyebrow>Seña</Eyebrow>
        <label className="flex items-center justify-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={abonaSena}
            onChange={(e) => {
              setTocado(true);
              setAbonaSena(e.target.checked);
              if (!e.target.checked) setSena("");
            }}
            className="h-4 w-4 rounded border-neutral-300 text-accent"
          />
          Abonó seña
        </label>
        {abonaSena && (
          <Field label="Monto de la seña (U$)" className="mx-auto max-w-xs">
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={sena}
              onChange={(e) => {
                setTocado(true);
                setSena(e.target.value);
              }}
              placeholder="0"
              className="!text-center"
            />
          </Field>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white/70 p-3 text-center sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Total</p>
          <p className="tabular-nums text-neutral-900">{fmtUsd(total)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Seña</p>
          <p className="tabular-nums text-neutral-900">{fmtUsd(Number.isFinite(senaNum) ? senaNum : 0)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Saldo por abonar
          </p>
          <p className="font-semibold tabular-nums text-neutral-900">{fmtUsd(saldo)}</p>
        </div>
      </div>

      {tocado && errorValidacion && <p className="mt-3 text-sm text-red-600">{errorValidacion}</p>}

      <div className="mt-5">
        <Field label="Nota">
          <Textarea
            rows={3}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Proveedor, color alternativo, medio de la seña…"
          />
        </Field>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Dialog>
  );
}

/** Detalle de un pedido + avance de estado (Pedido → Llegó → Entregado). */
export function PedidoDetalle({
  pedido,
  hoy,
  clientes,
  esAdmin,
  onClose,
  onEstado,
  onEditar,
  onEliminar,
}: {
  pedido: Pedido | null;
  hoy: string;
  clientes: ClienteOpcion[];
  esAdmin: boolean;
  onClose: () => void;
  onEstado: (p: Pedido, estado: PedidoEstado) => void;
  onEditar: (p: Pedido) => void;
  onEliminar: (p: Pedido) => void;
}) {
  const cliente = pedido?.clienteId ? clientes.find((c) => c.id === pedido.clienteId) : undefined;
  const vencido = pedido ? pedidoVencido(pedido, hoy) : false;
  const conItems = !!pedido && pedido.items.length > 0;
  return (
    <Dialog
      open={!!pedido}
      onClose={onClose}
      size="lg"
      title={pedido ? `Pedido · ${pedido.cliente}` : ""}
      description={pedido ? `Entrega: ${etiquetaDia(pedido.fechaEntrega)}` : ""}
      footer={
        pedido && (
          <>
            {esAdmin && (
              <Button icon={Trash2} onClick={() => onEliminar(pedido)} variant="danger-outline" fullOnMobile className="sm:mr-auto">
                Eliminar
              </Button>
            )}
            <Button onClick={onClose} variant="outline" fullOnMobile>
              Cerrar
            </Button>
            <Button icon={Pencil} onClick={() => onEditar(pedido)} variant="outline" fullOnMobile>
              Editar
            </Button>
            {pedidoAbierto(pedido) ? (
              <>
                <Button icon={X} onClick={() => onEstado(pedido, "cancelado")} variant="tonal" fullOnMobile>
                  Cancelar pedido
                </Button>
                {pedido.estado === "pedido" && (
                  <Button icon={PackageCheck} onClick={() => onEstado(pedido, "llego")} variant="tonal" fullOnMobile>
                    Llegó
                  </Button>
                )}
                <Button icon={Check} onClick={() => onEstado(pedido, "entregado")} variant="primary" fullOnMobile>
                  Entregado
                </Button>
              </>
            ) : (
              <Button icon={RotateCcw} onClick={() => onEstado(pedido, "pedido")} variant="tonal" fullOnMobile>
                Reabrir
              </Button>
            )}
          </>
        )
      }
    >
      {pedido && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Cliente</p>
              <p className="text-neutral-900">{pedido.cliente}</p>
              {cliente?.telefono && <p className="text-xs tabular-nums text-neutral-500">{cliente.telefono}</p>}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Entrega</p>
              <p className={cn("text-neutral-900", vencido && "font-semibold text-red-600")}>
                {etiquetaDia(pedido.fechaEntrega)}
                {vencido && " · vencido"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Estado</p>
              <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[pedidoEstado[pedido.estado].tone])} />
                {pedidoEstado[pedido.estado].label}
              </span>
            </div>
          </div>

          {conItems ? (
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Productos
                </p>
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full min-w-[420px]">
                    <thead>
                      <tr className="text-xs">
                        <th>Producto</th>
                        <th className="w-20">Cant.</th>
                        <th className="w-28">Precio</th>
                        <th className="w-28">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedido.items.map((item, indice) => (
                        <tr key={indice}>
                          <td className="px-2 py-1.5 text-start">{item.detalle}</td>
                          <td className="px-2 py-1.5 tabular-nums">{item.cantidad}</td>
                          <td className="px-2 py-1.5 tabular-nums">{fmtUsd(item.precioUsd)}</td>
                          <td className="px-2 py-1.5 tabular-nums">{fmtUsd(subtotalItem(item))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white/70 p-3 text-center sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Total</p>
                  <p className="tabular-nums text-neutral-900">{fmtUsd(totalPedido(pedido.items))}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Seña</p>
                  <p className="tabular-nums text-neutral-900">
                    {pedido.senaUsd > 0 ? fmtUsd(pedido.senaUsd) : "Sin seña"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Saldo por abonar
                  </p>
                  <p className="font-semibold tabular-nums text-neutral-900">
                    {fmtUsd(saldoPedido(pedido.items, pedido.senaUsd))}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Qué se pidió</p>
              <p className="text-neutral-900">{pedido.descripcion}</p>
            </div>
          )}

          {pedido.nota && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Nota</p>
              <p className="whitespace-pre-line text-neutral-700">{pedido.nota}</p>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
