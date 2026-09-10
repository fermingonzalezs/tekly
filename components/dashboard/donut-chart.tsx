export type DonutSlice = {
  label: string;
  pct: number;
  color: string;
  valueLabel: string;
};

const CXY = 64;
const R = 40;
const SW = 34; // anillo grueso -> poco hueco en el centro
const C = 2 * Math.PI * R;

// bordes internos/externos del anillo (con 1px de sobrante para el separador)
const RIN = R - SW / 2 - 1;
const ROUT = R + SW / 2 + 1;

/** Dona segmentada: % adentro del anillo, separadores blancos radiales. */
export function DonutChart({ slices }: { slices: DonutSlice[] }) {
  const sum = slices.reduce((a, s) => a + s.pct, 0) || 1;

  let acc = 0;
  const segs = slices.map((s) => {
    const frac = s.pct / sum;
    const len = frac * C;
    const dashOffset = -(acc * C);
    // ángulo del borde inicial del segmento (12 en punto = -90°)
    const startRad = acc * 2 * Math.PI - Math.PI / 2;
    const midRad = (acc + frac / 2) * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    return {
      ...s,
      len,
      dashOffset,
      startRad,
      tx: CXY + R * Math.cos(midRad),
      ty: CXY + R * Math.sin(midRad),
    };
  });

  return (
    <div className="flex w-full items-center gap-6">
      <svg viewBox="0 0 128 128" className="h-52 w-52 shrink-0">
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

        {/* separadores blancos radiales — uniformes en todo el anillo */}
        {segs.map((s, i) => (
          <line
            key={`d-${i}`}
            x1={CXY + RIN * Math.cos(s.startRad)}
            y1={CXY + RIN * Math.sin(s.startRad)}
            x2={CXY + ROUT * Math.cos(s.startRad)}
            y2={CXY + ROUT * Math.sin(s.startRad)}
            stroke="#fff"
            strokeWidth={2}
          />
        ))}

        {segs.map((s, i) => {
          const label = `${s.pct}%`;
          const w = label.length * 4.6 + 6;
          return (
            <g key={`t-${i}`}>
              {/* chip igual al del % de "Objetivo del mes": blanco translúcido */}
              <rect
                x={s.tx - w / 2}
                y={s.ty - 7}
                width={w}
                height={14}
                rx={3}
                fill="rgba(255,255,255,0.25)"
              />
              <text
                x={s.tx}
                y={s.ty}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="8"
                fontWeight="600"
                fill="#fff"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <ul className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
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
