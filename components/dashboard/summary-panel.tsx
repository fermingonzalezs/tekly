import { Card } from "@/components/ui/card";
import { monthGoal, ticketStages } from "@/lib/mock-data";

const R = 52;
const C = 2 * Math.PI * R;

export function SummaryPanel() {
  const pct = Math.min(1, monthGoal.current / monthGoal.target);
  const totalTickets = ticketStages.reduce((a, s) => a + s.count, 0);

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-neutral-500">Resumen del mes</p>

      <div className="mt-4 flex flex-col items-center">
        <div className="relative h-36 w-36">
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="12"
            />
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke="#2563eb"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold">
              {Math.round(pct * 100)}%
            </span>
            <span className="text-[11px] text-neutral-400">del objetivo</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          USD {monthGoal.current.toLocaleString("en-US")} de{" "}
          {monthGoal.target.toLocaleString("en-US")}
        </p>
      </div>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-neutral-500">Tickets activos</span>
          <span className="font-semibold">{totalTickets}</span>
        </div>
        <ul className="mt-3 space-y-2">
          {ticketStages.map((s) => (
            <li
              key={s.label}
              className="flex items-center gap-2 text-[13px] text-neutral-600"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: s.color }}
              />
              <span className="flex-1">{s.label}</span>
              <span className="font-semibold text-neutral-800">{s.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
