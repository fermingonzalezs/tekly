import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { GHOST_STRIPES, DASH_ACCENT } from "@/lib/chart";
import { fmtUsd } from "@/lib/format";
import { avanceObjetivo } from "@/lib/dashboard";

// `target` (la meta del mes) vive en `organizations.objetivo_mes_usd`,
// editable desde Configuración → Datos del negocio (`lib/db/configuracion.ts`).
// El resto es real y viene de `objetivoDelMes` (`lib/dashboard.ts`); los
// cálculos de avance/ritmo, de `avanceObjetivo` (puro, con test).
export function ObjetivoMes({
  current,
  dayOfMonth,
  daysInMonth,
  target,
  esActual,
  configurarHref,
}: {
  current: number;
  dayOfMonth: number;
  daysInMonth: number;
  target: number;
  /** El mes mostrado es el en curso (en uno pasado no hay "ritmo necesario"). */
  esActual: boolean;
  /** Link a cargar la meta cuando no hay (`null` en la demo). */
  configurarHref?: string | null;
}) {
  const a = avanceObjetivo({ current, target, dayOfMonth, daysInMonth });

  if (target <= 0) {
    return (
      <Card className="p-5">
        <ChartTitle align="left" divider>Objetivo del mes</ChartTitle>
        <p className="py-4 text-center text-sm text-neutral-500">
          Todavía no cargaste una meta de facturación.{" "}
          {configurarHref && (
            <Link href={configurarHref} className="font-medium text-accent hover:underline">
              Cargala en Configuración
            </Link>
          )}
        </p>
      </Card>
    );
  }

  const quedan = a.daysLeft === 1 ? "queda 1 día" : `quedan ${a.daysLeft} días`;

  return (
    <Card className="p-5">
      <ChartTitle
        align="left"
        sub={`Meta de facturación ${fmtUsd(target)}${esActual ? ` · ${quedan}` : " · mes cerrado"}`}
      >
        Objetivo del mes
      </ChartTitle>

      <div className="mt-3 border-t border-neutral-100 pt-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Facturado">
            {fmtUsd(current)}
            <Sufijo>/ {fmtUsd(target)}</Sufijo>
          </Tile>
          <Tile label={esActual ? "Proyección al cierre" : "Cierre del mes"}>
            {fmtUsd(esActual ? a.projected : current)}
            <Sufijo>{esActual ? a.projectedPct : a.pct}%</Sufijo>
          </Tile>
          <Tile label="Ritmo necesario">
            {esActual && a.falta > 0 ? (
              <>
                {fmtUsd(a.perDay)}
                <Sufijo>por día</Sufijo>
              </>
            ) : (
              "—"
            )}
          </Tile>
          <Tile label={a.falta > 0 ? "Falta para la meta" : "Meta cumplida"} destacada>
            {a.falta > 0 ? fmtUsd(a.falta) : fmtUsd(current - target)}
            {a.falta === 0 && <Sufijo destacada>por encima</Sufijo>}
          </Tile>
        </div>

        {/* barra: cumplido sólido sobre pista rayada + marca del ritmo ideal */}
        <div
          className="relative mt-5 h-2.5 rounded-full"
          style={{ background: GHOST_STRIPES }}
          role="img"
          aria-label={`${a.pct}% cumplido${esActual ? `, ritmo ideal ${a.ideal}%` : ""}`}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
            style={{ width: `${a.pct}%`, background: DASH_ACCENT }}
          />
          {esActual && (
            <span
              aria-hidden="true"
              className="absolute -top-1.5 h-[22px] w-0.5 -translate-x-1/2 rounded-full bg-neutral-800"
              style={{ left: `${Math.min(100, a.ideal)}%` }}
            />
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[12px] text-neutral-500">
          <span>
            <span className="font-semibold text-neutral-900">{a.pct}% cumplido</span>
            {esActual && ` · deberías ir por el ${a.ideal}% al día ${dayOfMonth}`}
          </span>
          {esActual && (
            <span className={cn("tabular-nums", a.diffPts < 0 ? "text-red-600" : "text-emerald-700")}>
              {a.diffPts === 0
                ? "Justo en el ritmo ideal"
                : `Vas ${Math.abs(a.diffPts)} pts ${a.diffPts < 0 ? "atrás" : "adelante"} del ritmo ideal`}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function Tile({
  label,
  children,
  destacada,
}: {
  label: string;
  children: React.ReactNode;
  destacada?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border px-4 py-3",
        destacada ? "border-table-header bg-table-header text-white" : "border-neutral-200 bg-white",
      )}
    >
      <p
        className={cn(
          "truncate text-[10px] font-semibold uppercase tracking-wider",
          destacada ? "text-white/75" : "text-neutral-500",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 truncate font-grotesk text-xl font-semibold tabular-nums",
          destacada ? "text-[#c9c5f5]" : "text-neutral-900",
        )}
      >
        {children}
      </p>
    </div>
  );
}

function Sufijo({ children, destacada }: { children: React.ReactNode; destacada?: boolean }) {
  return (
    <span
      className={cn(
        "ml-1.5 font-sans text-[11px] font-medium",
        destacada ? "text-white/70" : "text-neutral-500",
      )}
    >
      {children}
    </span>
  );
}
