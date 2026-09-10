import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { Delta } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import { GHOST_STRIPES, DASH_ACCENT } from "@/lib/chart";
import { monthGoal, salesByMonth } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

export function ObjetivoPanel() {
  const { current, target, dayOfMonth, daysInMonth } = monthGoal;

  const pct = Math.round(Math.min(1, current / target) * 100);
  const falta = Math.max(0, target - current);
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth);

  // proyección lineal al ritmo de lo que va del mes
  const projected = Math.round((current / dayOfMonth) * daysInMonth);
  const projectedPct = Math.round((projected / target) * 100);

  // U$/día que hace falta para cerrar el objetivo
  const perDay = daysLeft > 0 ? Math.ceil(falta / daysLeft) : falta;

  // variación vs el mes anterior de salesByMonth
  const prev = salesByMonth[salesByMonth.length - 2];
  const prevTotal =
    prev.equipos + prev.reparaciones + prev.accesorios + prev.otros;
  const momPct = ((current - prevTotal) / prevTotal) * 100;

  return (
    <Card className="flex flex-col p-4">
      <ChartTitle align="left" sub="Avance sobre la meta del mes">
        Objetivo del mes
      </ChartTitle>

      <div className="mt-3 flex flex-1 flex-col border-t border-neutral-100 pt-3">
        <div className="flex flex-1 flex-col justify-center gap-3">
          {/* barra gruesa: tramo cumplido en accent con chip %, resto rayado */}
          <div
            className="relative h-9 w-full overflow-hidden rounded-full"
            style={{ background: GHOST_STRIPES }}
          >
            <div
              className="absolute inset-y-0 left-0 flex items-center justify-end rounded-full pr-2"
              style={{ width: `${pct}%`, background: DASH_ACCENT }}
            >
              <span className="rounded-md bg-white/25 px-1.5 py-1 text-[11px] font-semibold leading-none text-white tabular-nums">
                {pct}%
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-neutral-400">faltan {fmtUsd(falta)}</span>
            <span className="tabular-nums text-neutral-500">
              <span className="font-semibold text-neutral-800">
                {fmtUsd(current)}
              </span>{" "}
              / {fmtUsd(target)}
            </span>
          </div>
        </div>

        <div className="mt-3 flex justify-between gap-3 border-t border-neutral-200 pt-3">
          <Stat
            label="Proyección"
            value={fmtUsd(projected)}
            hint={`${projectedPct}% del objetivo`}
          />
          <Stat
            className="text-center"
            label="Ritmo necesario"
            value={
              <>
                {fmtUsd(perDay)}
                <span className="font-normal text-neutral-400">/día</span>
              </>
            }
            hint={`${daysLeft} días restantes`}
          />
          <Stat
            className="text-right"
            label={`vs ${prev.mes}`}
            value={
              <Delta value={momPct} className="px-1.5 py-0.5 text-[10px]" />
            }
            hint={fmtUsd(prevTotal)}
          />
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
  valueClassName,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p
        className={cn(
          "text-[13px] font-semibold tabular-nums text-neutral-900",
          valueClassName,
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <p className="text-[11px] tabular-nums text-neutral-400">{hint}</p>
    </div>
  );
}
