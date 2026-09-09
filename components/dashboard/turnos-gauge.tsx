import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { turnos } from "@/lib/mock-data";
import { turnoTipo } from "@/lib/status";
import type { TurnoTipo } from "@/lib/types";

const COLOR: Record<TurnoTipo, string> = {
  compra: "#10b981",
  deja: "#3b82f6",
  retira: "#8b5cf6",
  cotizar: "#f59e0b",
};
const ORDER: TurnoTipo[] = ["compra", "deja", "retira", "cotizar"];

const CX = 120;
const CY = 116;
const R = 92;
const SW = 22;
const GAP = 3; // grados de separación entre segmentos

// ángulo medido desde arriba, positivo en sentido horario
function polar(deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
}
function arc(a0: number, a1: number): string {
  const [x0, y0] = polar(a0);
  const [x1, y1] = polar(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
}

export function TurnosGauge({ className }: { className?: string }) {
  const activos = turnos.filter((t) => t.estado !== "cancelado");
  const total = activos.length || 1;

  const rows = ORDER.map((tipo) => ({
    tipo,
    label: turnoTipo[tipo].label,
    color: COLOR[tipo],
    count: activos.filter((t) => t.tipo === tipo).length,
  })).filter((r) => r.count > 0);

  let acc = 0;
  const segs = rows.map((r) => {
    const a0 = -90 + (acc / total) * 180;
    acc += r.count;
    const a1 = -90 + (acc / total) * 180;
    return { ...r, a0, a1 };
  });

  return (
    <Card className={cn("flex flex-col overflow-hidden p-4", className)}>
      <ChartTitle align="left">Turnos agendados</ChartTitle>

      <div className="mt-1 flex min-h-0 flex-1 items-center gap-3">
        <svg
          viewBox="0 0 240 140"
          preserveAspectRatio="xMinYMid meet"
          className="h-full min-h-0 flex-1"
        >
          <path
            d={arc(-90, 90)}
            fill="none"
            stroke="#f1f1f1"
            strokeWidth={SW}
            strokeLinecap="round"
          />
          {segs.map((s) => (
            <path
              key={s.tipo}
              d={arc(
                s.a0 + (s.a0 > -90 ? GAP / 2 : 0),
                s.a1 - (s.a1 < 90 ? GAP / 2 : 0),
              )}
              fill="none"
              stroke={s.color}
              strokeWidth={SW}
              strokeLinecap="round"
            />
          ))}
          <text
            x={CX}
            y="86"
            textAnchor="middle"
            fontSize="11"
            fill="#a3a3a3"
          >
            Próximos 7 días
          </text>
          <text
            x={CX}
            y="118"
            textAnchor="middle"
            fontSize="34"
            fontWeight="700"
            fill="#171717"
          >
            {activos.length}
          </text>
        </svg>

        <ul className="shrink-0 space-y-2 text-[13px]">
          {rows.map((r) => (
            <li key={r.tipo} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: r.color }}
              />
              <span className="whitespace-nowrap text-neutral-600">
                {r.label}
              </span>
              <span className="ml-auto pl-3 font-semibold tabular-nums">
                {r.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
