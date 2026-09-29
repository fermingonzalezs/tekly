/**
 * Ilustración abstracta del dashboard del sistema (para hero/showcase de la
 * landing): divs + un poco de SVG, paleta índigo/neutros. No es un screenshot
 * real ni importa nada de la app de gestión -- es decorativa, sin datos.
 */

const NAV_ITEMS = ["Dashboard", "Ventas", "Reparaciones", "Inventario", "Turnos"];

const BARS = [34, 52, 41, 66, 48, 74, 58, 88, 63, 96, 70, 82];

const ROWS = [
  { item: "iPhone 14 Pro", monto: "U$ 985", tone: "bg-emerald-400" },
  { item: "Cambio de batería", monto: "U$ 39", tone: "bg-sky-400" },
  { item: "iPhone 13 128GB", monto: "U$ 620", tone: "bg-emerald-400" },
  { item: "Pantalla 12 Pro Max", monto: "U$ 145", tone: "bg-sky-400" },
];

export function MockupDashboard({ className }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-accent/10 ${className ?? ""}`}
      aria-hidden="true"
    >
      {/* Barra superior tipo navegador */}
      <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
        <div className="ml-3 h-4 flex-1 rounded-full bg-neutral-100" />
      </div>

      {/* Topnav de la app */}
      <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent text-[8px] font-bold text-white">
            T
          </div>
          <span className="font-grotesk text-xs font-semibold text-neutral-900">
            Tekly
          </span>
        </div>
        <div className="ml-2 hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map((item, i) => (
            <span
              key={item}
              className={`rounded-full px-2.5 py-1 text-[9px] font-medium ${
                i === 0
                  ? "bg-accent-soft text-accent"
                  : "text-neutral-400"
              }`}
            >
              {item}
            </span>
          ))}
        </div>
        <div className="ml-auto h-2 w-14 rounded-full bg-neutral-100" />
      </div>

      <div className="space-y-3 bg-neutral-50 p-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {["Facturado", "Ventas", "Tickets"].map((label, i) => (
            <div key={label} className="rounded-xl border border-neutral-200 bg-white p-2.5">
              <div className="text-[8px] font-semibold uppercase tracking-wider text-neutral-400">
                {label}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-grotesk text-sm font-semibold tabular-nums text-neutral-900">
                  {["48.250", "132", "18"][i]}
                </span>
                <span className="text-[8px] font-medium text-emerald-500">
                  {["+12%", "+8%", "+5%"][i]}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico de tendencia */}
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
              Facturación del mes
            </span>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[8px] font-semibold text-accent">
              U$ 48.250
            </span>
          </div>
          <div className="flex h-16 items-end gap-1">
            {BARS.map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className={`flex-1 rounded-t-md ${
                  i === 9 ? "bg-accent" : "bg-accent/25"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Tabla de actividad */}
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 bg-table-header px-3 py-1.5 text-[8px] font-bold uppercase tracking-wider text-white">
            Actividad reciente
          </div>
          {ROWS.map((row, i) => (
            <div
              key={row.item}
              className={`flex items-center gap-2 px-3 py-2 text-[9px] ${
                i % 2 === 0 ? "bg-white" : "bg-accent-soft"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${row.tone}`} />
              <span className="font-medium text-neutral-700">{row.item}</span>
              <span className="ml-auto font-semibold tabular-nums text-neutral-900">
                {row.monto}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
