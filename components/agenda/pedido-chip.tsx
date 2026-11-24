"use client";

import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { pedidoVencido } from "@/lib/agenda";
import { pedidoEstado } from "@/lib/status";
import type { Pedido } from "@/lib/types";

/** Forma por estado (mismo criterio que los turnos): borde = pedido, lleno =
 * llegó (listo para entregar), apagado = entregado, tachado = cancelado. */
const FORMA: Record<Pedido["estado"], string> = {
  pedido: "border-accent/60 bg-white text-neutral-900 hover:bg-accent-soft",
  llego: "border-accent bg-accent text-white hover:bg-accent/90",
  entregado: "border-neutral-200 bg-neutral-100 text-neutral-500",
  cancelado: "border-dashed border-neutral-300 bg-white text-neutral-500 line-through",
};

/** Pedido en la fila «Todo el día» del calendario (y en la vista Mes). */
export function PedidoChip({
  pedido,
  hoy,
  onClick,
  conDescripcion = true,
}: {
  pedido: Pedido;
  hoy: string;
  onClick: () => void;
  /** En celdas angostas (Semana/Mes) solo va el cliente. */
  conDescripcion?: boolean;
}) {
  const vencido = pedidoVencido(pedido, hoy);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Pedido · ${pedido.cliente} · ${pedido.descripcion} · ${pedidoEstado[pedido.estado].label}${vencido ? " · vencido" : ""}`}
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded border px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors",
        FORMA[pedido.estado],
        vencido && "border-red-500",
      )}
    >
      <Package aria-hidden className="h-3 w-3 shrink-0" />
      <span className="truncate">
        <span className="font-semibold">{pedido.cliente}</span>
        {conDescripcion && <span className="opacity-80"> · {pedido.descripcion}</span>}
      </span>
      {vencido && <span aria-hidden className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />}
    </button>
  );
}
