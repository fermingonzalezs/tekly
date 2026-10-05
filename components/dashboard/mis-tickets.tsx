import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { dotClass, ticketStatus } from "@/lib/status";
import type { TicketTecnico } from "@/lib/dashboard";

/** "Mis tickets" del dashboard de técnico: sus tickets abiertos ordenados
 * por estado (`ticketsDeTecnico` en `lib/dashboard.ts`, se calcula en el
 * server). Cada fila lleva a Reparaciones con la búsqueda del id. */
export function MisTickets({
  className,
  tickets,
}: {
  className?: string;
  tickets: TicketTecnico[];
}) {
  return (
    <Card className={cn("flex min-h-0 flex-col p-4", className)}>
      <ChartTitle align="left" divider sub="Tus tickets sin entregar">
        Mis tickets
      </ChartTitle>
      {tickets.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          No tenés tickets abiertos
        </p>
      ) : (
        <ul className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-auto">
          {tickets.map((t) => {
            const st = ticketStatus[t.estado];
            return (
              <li key={t.id}>
                <Link
                  href={`/reparaciones?q=${t.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-neutral-50"
                >
                  <span className="shrink-0 text-[13px] font-medium tabular-nums text-neutral-500">
                    #{t.id}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-900">
                    {t.equipo}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", dotClass[st.tone])}
                    />
                    {st.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
