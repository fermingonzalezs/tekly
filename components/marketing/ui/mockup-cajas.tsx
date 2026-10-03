import { MockupChrome } from "./mockup-chrome";

/**
 * Ilustración de /cajas para el showcase de la landing: mismos 5
 * StatCard (un medio de pago cada uno) y panel "Por medio de pago (ARS)"
 * que el real (`cajas-client.tsx` + `lib/status.ts`), con los valores
 * EXACTOS de la captura de pantalla real que compartió el usuario -- no
 * inventados. Mismas convenciones de escala que `MockupTurnos` (mismos
 * tamaños de fuente por rol: 5px labels, 5.5-6.5px contenido/valores,
 * dots de 4px) y la misma cantidad de filas aproximada, para que las dos
 * ilustraciones del showcase tengan un porte comparable. Header de tabla
 * en banda índigo (`bg-table-header`): regla global de `app/globals.css`
 * (`th { background: var(--chart-1) ... }`, sin `@layer` -- le gana a
 * cualquier clase que el componente real le ponga al `<th>`), aunque el
 * código fuente de Cajas use clases de texto gris en sus headers. Cajas
 * no es una de las 6 categorías del topnav (vive dentro de "Finanzas"),
 * así que esa es la pill activa.
 */

const STATS = [
  { label: "Efectivo (pesos)", valor: "$ 1.688.900", hint: "≈ U$ 1.083" },
  { label: "Dólares", valor: "$ 3.978.000", hint: "≈ U$ 2.550" },
  { label: "Transferencia", valor: "$ 1.303.850", hint: "≈ U$ 836" },
  { label: "Cripto", valor: "$ 0", hint: "≈ U$ 0" },
  { label: "Tarjeta de crédito", valor: "$ 505.425", hint: "≈ U$ 324" },
];

// 10 filas (mismo criterio de porte que las 12 de MockupTurnos) --
// las primeras 5 son las reales de la captura, el resto completa el
// historial con el mismo tipo de movimiento (venta en distintos medios).
const MOVIMIENTOS = [
  { hora: "18:05", concepto: "Entrega ticket #13 · F. Gonzalez Sardi", caja: "CAJA USD", medio: "Dólares", dot: "bg-emerald-500", monto: "+U$ 30" },
  { hora: "14:38", concepto: "Venta V-26 · Diego Sánchez", caja: "CAJA USD", medio: "Dólares", dot: "bg-emerald-500", monto: "+U$ 880" },
  { hora: "18:43", concepto: "Venta V-25 · F. Gonzalez Sardi", caja: "CAJA ARS", medio: "Efectivo (pesos)", dot: "bg-emerald-500", monto: "+$ 873.600" },
  { hora: "18:00", concepto: "Venta a Valentina López", caja: "CAJA USD", medio: "Dólares", dot: "bg-emerald-500", monto: "+U$ 50" },
  { hora: "14:00", concepto: "Venta a Nicolás Rodríguez", caja: "TARJETA", medio: "Tarjeta de crédito", dot: "bg-amber-500", monto: "+$ 73.250" },
  { hora: "13:40", concepto: "Venta a Lucía Fernández", caja: "CAJA USD", medio: "Dólares", dot: "bg-emerald-500", monto: "+U$ 260" },
  { hora: "12:15", concepto: "Compra de repuestos a proveedor", caja: "CAJA USD", medio: "Dólares", dot: "bg-emerald-500", monto: "−U$ 150" },
  { hora: "11:30", concepto: "Venta a Martín Gómez", caja: "CAJA ARS", medio: "Efectivo (pesos)", dot: "bg-emerald-500", monto: "+$ 468.800" },
  { hora: "10:45", concepto: "Venta a Sofía Martínez", caja: "TRANSFERENCIAS", medio: "Transferencia", dot: "bg-blue-500", monto: "+$ 87.900" },
  { hora: "09:20", concepto: "Venta a Julieta Romero", caja: "CAJA ARS", medio: "Efectivo (pesos)", dot: "bg-emerald-500", monto: "+$ 65.925" },
];

const PANEL = [
  { label: "Efectivo (pesos)", dot: "bg-emerald-500", valor: "$ 1.688.900", hint: "≈ U$ 1.083" },
  { label: "Dólares", dot: "bg-emerald-500", valor: "$ 3.978.000", hint: "≈ U$ 2.550" },
  { label: "Transferencia", dot: "bg-blue-500", valor: "$ 1.303.850", hint: "≈ U$ 836" },
  { label: "Tarjeta de crédito", dot: "bg-amber-500", valor: "$ 505.425", hint: "≈ U$ 324" },
  { label: "Mercadería", dot: "bg-neutral-400", valor: "$ 327.600", hint: "≈ U$ 210" },
];

export function MockupCajas({ className }: { className?: string }) {
  return (
    <div
      className={`flex aspect-video flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-accent/10 ${className ?? ""}`}
      aria-hidden="true"
    >
      <MockupChrome activo="Finanzas" />

      <div className="flex gap-1 border-b border-neutral-100 px-3 py-1.5">
        <span className="rounded-full border border-accent bg-white px-1.5 py-[3px] text-[5px] font-medium text-accent">
          Movimientos
        </span>
        <span className="rounded-full border border-transparent px-1.5 py-[3px] text-[5px] font-medium text-neutral-500">
          Conciliaciones
        </span>
        <span className="rounded-full border border-transparent px-1.5 py-[3px] text-[5px] font-medium text-neutral-500">
          Cajas
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1 px-3 py-2">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-md border border-neutral-200 p-1">
            <p className="truncate text-[5px] font-semibold uppercase tracking-wide text-neutral-400">
              {s.label}
            </p>
            <p className="font-grotesk text-[6.5px] font-bold tabular-nums text-neutral-900">
              {s.valor}
            </p>
            <p className="text-[5px] text-neutral-400">{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-neutral-100 px-3 pb-2">
        <span className="rounded-full border border-accent bg-white px-1.5 py-[3px] text-[5px] font-medium text-accent">
          Desde conciliación
        </span>
        <span className="rounded-full border border-neutral-200 px-1.5 py-[3px] text-[5px] font-medium text-neutral-500">
          Historial
        </span>
        <span className="ml-auto flex items-center gap-0.5 rounded-full border border-accent/40 px-1.5 py-[3px] text-[5px] font-semibold text-accent">
          + Nuevo movimiento
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_80px] overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: "26px 1fr 42px 56px 42px" }}>
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            Hora
          </div>
          <div className="bg-table-header px-1 py-1 text-[5px] font-bold uppercase tracking-wide text-white">
            Concepto
          </div>
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            Caja
          </div>
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            Medio
          </div>
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            Monto
          </div>

          {MOVIMIENTOS.map((m, i) => {
            const egreso = m.monto.startsWith("−");
            return (
              <div key={m.concepto} className="contents">
                <div
                  className={`border-t border-neutral-100 px-1 py-1 text-center text-[5.5px] text-neutral-400 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
                >
                  {m.hora}
                </div>
                <div
                  className={`flex items-center gap-0.5 truncate border-t border-neutral-100 px-1 py-1 text-[5.5px] text-neutral-700 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
                >
                  <svg viewBox="0 0 16 16" className={`h-[6px] w-[6px] shrink-0 ${egreso ? "text-red-400" : "text-emerald-500"}`}>
                    {egreso ? (
                      <path d="M4 4 L12 12 M12 4 V11.5 M4.5 4 H12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <path d="M12 4 L4 12 M4 4.5 V12 M4 12 H11.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>
                  <span className="truncate">{m.concepto}</span>
                </div>
                <div
                  className={`border-t border-neutral-100 px-1 py-1 text-center text-[5px] text-neutral-500 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
                >
                  {m.caja}
                </div>
                <div
                  className={`border-t border-neutral-100 px-1 py-1 text-center ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
                >
                  <span className="inline-flex items-center gap-0.5 rounded bg-neutral-100 px-1 py-[1px] text-[5px] font-medium text-neutral-700">
                    <span className={`h-1 w-1 rounded-full ${m.dot}`} />
                    {m.medio}
                  </span>
                </div>
                <div
                  className={`border-t border-neutral-100 px-1 py-1 text-center text-[5.5px] font-semibold ${egreso ? "text-red-500" : "text-emerald-600"} ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
                >
                  {m.monto}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-l border-neutral-100 p-1.5">
          <p className="mb-1 border-b border-neutral-100 pb-1 text-[5px] font-semibold uppercase tracking-wide text-neutral-500">
            Por medio de pago
          </p>
          <div className="space-y-1.5">
            {PANEL.map((p) => (
              <div key={p.label}>
                <span className="flex items-center gap-0.5 truncate rounded bg-neutral-100 px-1 py-[1px] text-[5px] font-medium text-neutral-700">
                  <span className={`h-1 w-1 shrink-0 rounded-full ${p.dot}`} />
                  <span className="truncate">{p.label}</span>
                </span>
                <p className="mt-0.5 text-right text-[5.5px] font-semibold tabular-nums text-neutral-900">
                  {p.valor}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
