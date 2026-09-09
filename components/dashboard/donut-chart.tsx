export type DonutSlice = {
  label: string;
  pct: number;
  color: string;
  valueLabel: string;
};

const CXY = 64;
const R = 40;
const SW = 34; // anillo grueso -> poco hueco en el centro
const GAP = 1.5; // separación fina entre segmentos (unidades de circunferencia)
const C = 2 * Math.PI * R;

/** Dona segmentada: % adentro del anillo, cortes rectos, leyenda debajo. */
export function DonutChart({ slices }: { slices: DonutSlice[] }) {
  const sum = slices.reduce((a, s) => a + s.pct, 0) || 1;

  let acc = 0;
  const segs = slices.map((s) => {
    const frac = s.pct / sum;
    const len = Math.max(2, frac * C - GAP);
    const dashOffset = -(acc * C);
    const midRad = (acc + frac / 2) * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    return {
      ...s,
      len,
      dashOffset,
      tx: CXY + R * Math.cos(midRad),
      ty: CXY + R * Math.sin(midRad),
    };
  });

  return (
    <div className="w-full">
      <div className="flex justify-center">
        <svg viewBox="0 0 128 128" className="h-44 w-44">
          <g transform="rotate(-90 64 64)">
            <circle
              cx={CXY}
              cy={CXY}
              r={R}
              fill="none"
              stroke="#fff"
              strokeWidth={SW}
            />
            {segs.map((s, i) => (
              <circle
                key={i}
                cx={CXY}
                cy={CXY}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={SW}
                strokeLinecap="butt"
                strokeDasharray={`${s.len} ${C - s.len}`}
                strokeDashoffset={s.dashOffset}
              />
            ))}
          </g>
          {segs.map((s, i) => (
            <text
              key={`t-${i}`}
              x={s.tx}
              y={s.ty}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fontWeight="500"
              fill="#1f2937"
            >
              {s.pct}%
            </text>
          ))}
        </svg>
      </div>

      <ul className="mx-auto mt-2 grid max-w-[300px] grid-cols-2 gap-x-5 gap-y-1 text-xs">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            <span className="truncate text-neutral-600">{s.label}</span>
            <span className="ml-auto shrink-0 font-medium tabular-nums text-neutral-800">
              {s.valueLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
