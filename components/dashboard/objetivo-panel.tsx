import { Card } from "@/components/ui/card";
import { monthGoal } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

// Mismo anillo que DonutChart (components/dashboard/donut-chart.tsx).
const CXY = 64;
const R = 40;
const SW = 34;
const C = 2 * Math.PI * R;

export function ObjetivoPanel() {
  const pct = Math.round(
    Math.min(1, monthGoal.current / monthGoal.target) * 100,
  );
  const falta = Math.max(0, monthGoal.target - monthGoal.current);
  const len = (pct / 100) * C;

  return (
    <Card className="flex flex-col items-center justify-center p-4">
      <p className="self-stretch text-center text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Objetivo del mes
      </p>

      <div className="relative mt-3">
        <svg viewBox="0 0 128 128" className="h-44 w-44">
          <g transform="rotate(-90 64 64)">
            <circle
              cx={CXY}
              cy={CXY}
              r={R}
              fill="none"
              stroke="#eff4ff"
              strokeWidth={SW}
            />
            <circle
              cx={CXY}
              cy={CXY}
              r={R}
              fill="none"
              stroke="#2563eb"
              strokeWidth={SW}
              strokeLinecap="butt"
              strokeDasharray={`${len} ${C - len}`}
            />
          </g>
          <text
            x="64"
            y="64"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="20"
            fontWeight="600"
            fill="#171717"
          >
            {pct}%
          </text>
        </svg>
      </div>

      <p className="mt-3 text-center text-xs text-neutral-500">
        <span className="font-semibold text-neutral-800">
          {fmtUsd(monthGoal.current)}
        </span>{" "}
        / {fmtUsd(monthGoal.target)} · faltan {fmtUsd(falta)}
      </p>
    </Card>
  );
}
