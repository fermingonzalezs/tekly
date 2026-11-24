import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { bandClass } from "@/lib/status";
import type { AgendaItem, AgendaLocal } from "@/lib/dashboard";

/** "Agenda del local": tickets listos sin retirar + próximos turnos, como
 * tarjetas con banda de color (tono de `lib/status.ts`), y a la derecha los
 * contadores del día. Con `enlaces={false}` (demo) las tarjetas no linkean:
 * Turnos y Reparaciones no existen fuera de la app. */
export function AgendaLocalCard({
  agenda,
  enlaces = true,
}: {
  agenda: AgendaLocal;
  enlaces?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <ChartTitle align="left" sub="Turnos de los próximos días y tickets que esperan algo de vos">
          Agenda del local
        </ChartTitle>
        {enlaces && (
          <Link
            href="/agenda"
            className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-accent hover:underline"
          >
            Ver la agenda
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="mt-3 grid gap-3 border-t border-neutral-100 pt-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
        {agenda.items.length === 0 ? (
          <p className="flex items-center justify-center rounded-xl border border-dashed border-neutral-200 py-8 text-sm text-neutral-500">
            Nada pendiente: no hay turnos próximos ni equipos listos para retirar
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {agenda.items.map((it) => (
              <ItemAgenda key={it.key} item={it} enlaces={enlaces} />
            ))}
          </div>
        )}

        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-neutral-50 p-3 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-neutral-200/70 lg:px-4 lg:py-1">
          <Contador label="Turnos hoy" value={agenda.turnosHoy} />
          <Contador label="Tickets abiertos" value={agenda.ticketsAbiertos} />
          <Contador label="Listos p/ retirar" value={agenda.listos} alerta={agenda.listos > 0} />
        </dl>
      </div>
    </Card>
  );
}

function ItemAgenda({ item, enlaces }: { item: AgendaItem; enlaces: boolean }) {
  const href = item.accion === "ticket" ? `/reparaciones?q=${item.ref}` : "/agenda";
  const accion = item.accion === "ticket" ? "Ver ticket" : "Ver turno";
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <p
        className={cn(
          "truncate px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white",
          bandClass[item.tone],
        )}
        title={item.banda}
      >
        {item.banda}
      </p>
      <div className="flex flex-1 flex-col items-center px-3 py-3 text-center">
        <p className="w-full truncate text-sm font-semibold text-neutral-900">{item.cliente}</p>
        <p className="mt-0.5 w-full truncate text-[13px] text-neutral-600" title={item.detalle}>
          {item.detalle}
        </p>
        {item.sub && (
          <p className="mt-0.5 w-full truncate text-[11px] text-neutral-500" title={item.sub}>
            {item.sub}
          </p>
        )}
      </div>
      {enlaces && (
        <Link
          href={href}
          className="flex items-center justify-center gap-1 border-t border-neutral-100 py-2 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-accent"
        >
          {accion}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function Contador({ label, value, alerta }: { label: string; value: number; alerta?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 lg:flex-row lg:justify-between lg:py-3">
      <dt className="text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 lg:text-left">
        {label}
      </dt>
      <dd
        className={cn(
          "font-grotesk text-xl font-semibold tabular-nums",
          alerta ? "text-red-600" : "text-neutral-900",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
