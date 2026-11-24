import { Card } from "@/components/ui/card";
import { fmtUsd } from "@/lib/format";
import type { Ticket } from "@/lib/types";

/** Presupuesto aceptado + servicios de un ticket listo -- de solo lectura,
 * tanto en "Retira reparación" del dialog de agendar como en el detalle de
 * un turno ya agendado. */
export function TicketResumen({ ticket }: { ticket: Ticket | null }) {
  if (!ticket) return null;
  return (
    <div>
      <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Reparación a retirar
      </p>
      <Card className="p-3">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-neutral-500">Presupuesto aceptado</span>
          <span className="font-semibold tabular-nums">{fmtUsd(ticket.presupuestoUsd)}</span>
        </div>
        {ticket.servicios.length > 0 && (
          <div className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {ticket.servicios.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{s.nombre}</span>
                <span className="shrink-0 tabular-nums text-neutral-500">{fmtUsd(s.precioUsd)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
