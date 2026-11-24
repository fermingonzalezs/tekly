"use client";

import { useState } from "react";
import { Check, PackageCheck, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, GrillaCampos, Input, Textarea } from "@/components/ui/field";
import { ClientePicker } from "@/components/ui/cliente-picker";
import { cn } from "@/lib/utils";
import { etiquetaDia, pedidoAbierto, pedidoVencido } from "@/lib/agenda";
import { dotClass, pedidoEstado } from "@/lib/status";
import type { ClienteOpcion, ClienteSeleccion, Pedido, PedidoEstado } from "@/lib/types";
import type { PedidoInput } from "@/app/(app)/agenda/actions";

/** Alta / edición de un pedido: cliente, qué se pidió, fecha de entrega y
 * nota. Va a la fila «Todo el día» del calendario en su fecha. */
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
  const [descripcion, setDescripcion] = useState(pedido?.descripcion ?? "");
  const [fechaEntrega, setFechaEntrega] = useState(pedido?.fechaEntrega ?? fechaInicial);
  const [nota, setNota] = useState(pedido?.nota ?? "");

  const valido = !!cliente && cliente.nombre.trim() !== "" && descripcion.trim() !== "" && !!fechaEntrega;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
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
              onSubmit({ cliente, descripcion, fechaEntrega, nota })
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
            onChange={setCliente}
            allowLibre
          />
        </Field>
        <Field label="Fecha de entrega">
          <Input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
        </Field>
        <Field label="Qué se pidió" className="sm:col-span-3">
          <Input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: iPhone 15 Pro 256 GB titanio natural"
          />
        </Field>
        <Field label="Nota" className="sm:col-span-3">
          <Textarea
            rows={3}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Seña, precio acordado, proveedor…"
          />
        </Field>
      </GrillaCampos>
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
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Qué se pidió</p>
            <p className="text-neutral-900">{pedido.descripcion}</p>
          </div>
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
