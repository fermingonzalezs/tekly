import { Card } from "@/components/ui/card";
import { salesTrend } from "@/lib/mock-data";

const W = 640;
const H = 200;
const PAD = 8;

function path(data: number[]) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = (W - PAD * 2) / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = PAD + i * step;
    const y = PAD + (H - PAD * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`;
  return { line, area };
}

export function TrendChart() {
  const { line, area } = path(salesTrend);
  const total = salesTrend.reduce((a, b) => a + b, 0);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-500">
            Tendencia de ventas
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            USD {total.toLocaleString("en-US")}
          </p>
          <p className="text-xs text-neutral-400">Últimos 14 días</p>
        </div>
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
          +18,3 %
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 h-44 w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#fill)" />
        <path
          d={line}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Card>
  );
}
