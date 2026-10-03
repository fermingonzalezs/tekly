import { MockupChrome } from "./mockup-chrome";
import { TurnoCursorDemo } from "./turno-cursor-demo";

/**
 * Ilustración del calendario de Turnos para el hero de la landing: ventana
 * de app (puntitos + topnav), pero el topnav es ahora el real de
 * `components/topnav.tsx` -- mismas 6 categorías de `lib/nav.ts`
 * (`navCategoriesForRole`), mismo logo (ícono + "TEKLY" / "by tekly" en
 * dos líneas) y mismo cluster de la derecha (Dólar blue + campana +
 * avatar). Turnos vive dentro del grupo "Ventas" (no es su propia
 * categoría), así que la pill activa acá es "Ventas", igual que en el
 * sistema real al navegar a /turnos. Contenido del calendario con los
 * colores exactos de `turnoTipo`/`dotClass` (`lib/status.ts`:
 * compra=emerald-500, deja=blue-500, retira=violet-500, cotizar=amber-500).
 * No es un componente de datos: es decorativo, sin lógica, igual criterio
 * que `MockupDashboard`.
 */

const TIPOS = [
  { label: "Compra equipo", dot: "bg-emerald-500" },
  { label: "Deja reparación", dot: "bg-blue-500" },
  { label: "Retira reparación", dot: "bg-violet-500" },
  { label: "Cotizar", dot: "bg-amber-500" },
];

const DIAS = [
  { dow: "SÁB", fecha: "3" },
  { dow: "DOM", fecha: "4" },
  { dow: "LUN", fecha: "5" },
  { dow: "MAR", fecha: "6" },
  { dow: "MIÉ", fecha: "7" },
  { dow: "JUE", fecha: "8" },
  { dow: "VIE", fecha: "9" },
];

const HORAS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
];

type Turno = { nombre: string; tipo: number };

// Matriz 12 horas x 7 días -- null = hueco libre ("+"). Los índices de tipo
// mapean a `TIPOS` arriba. Densidad intencional (~45%), no un calendario
// vacío ni saturado -- ver plan 004. Más filas que antes para que el
// mockup tenga más alto (pedido explícito), misma densidad relativa.
const GRILLA: (Turno | null)[][] = [
  [{ nombre: "F. González", tipo: 2 }, null, null, { nombre: "Agustín M.", tipo: 0 }, null, { nombre: "Valentina L.", tipo: 1 }, null],
  [null, { nombre: "Diego S.", tipo: 1 }, { nombre: "Nicolás R.", tipo: 0 }, null, null, { nombre: "Sofía M.", tipo: 1 }, null],
  [null, null, { nombre: "Martín G.", tipo: 3 }, { nombre: "Lucía F.", tipo: 2 }, null, null, { nombre: "Julieta R.", tipo: 0 }],
  [{ nombre: "Federico D.", tipo: 1 }, null, null, { nombre: "Camila T.", tipo: 0 }, { nombre: "Bruno A.", tipo: 1 }, null, null],
  [null, { nombre: "Agustín M.", tipo: 2 }, null, null, { nombre: "Diego S.", tipo: 0 }, null, { nombre: "Sofía M.", tipo: 3 }],
  [{ nombre: "Valentina L.", tipo: 0 }, null, null, { nombre: "Martín G.", tipo: 1 }, null, null, { nombre: "Lucía F.", tipo: 2 }],
  [null, { nombre: "Camila T.", tipo: 1 }, { nombre: "Bruno A.", tipo: 0 }, null, { nombre: "Julieta R.", tipo: 2 }, null, null],
  [{ nombre: "F. González", tipo: 0 }, null, null, { nombre: "Nicolás R.", tipo: 3 }, null, { nombre: "Federico D.", tipo: 1 }, null],
  [null, null, { nombre: "Sofía M.", tipo: 2 }, null, { nombre: "Valentina L.", tipo: 0 }, null, { nombre: "Diego S.", tipo: 1 }],
  [{ nombre: "Martín G.", tipo: 1 }, null, null, { nombre: "Lucía F.", tipo: 0 }, null, { nombre: "Agustín M.", tipo: 3 }, null],
  [null, { nombre: "Julieta R.", tipo: 2 }, null, null, { nombre: "Bruno A.", tipo: 1 }, null, { nombre: "Camila T.", tipo: 0 }],
  [{ nombre: "Nicolás R.", tipo: 0 }, null, { nombre: "Federico D.", tipo: 2 }, null, null, { nombre: "F. González", tipo: 1 }, null],
];

export function MockupTurnos({ className }: { className?: string }) {
  return (
    <div
      id="mockup-turnos-root"
      className={`relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-accent/10 ${className ?? ""}`}
      aria-hidden="true"
    >
      <MockupChrome activo="Ventas" />

      {/* Leyenda de tipos */}
      <div className="flex flex-wrap gap-1 border-y border-neutral-100 px-3 py-1.5">
        {TIPOS.map((t) => (
          <span
            key={t.label}
            className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-[3px] text-[6px] font-medium text-neutral-600"
          >
            <span className={`h-1 w-1 rounded-full ${t.dot}`} />
            {t.label}
          </span>
        ))}
      </div>

      {/* Grilla semanal */}
      <div className="grid" style={{ gridTemplateColumns: "26px repeat(7, 1fr)" }}>
        <div className="bg-table-header" />
        {DIAS.map((d) => (
          <div key={d.dow} className="bg-table-header px-0.5 py-1 text-center">
            <p className="text-[5px] font-bold uppercase tracking-wide text-white/60">
              {d.dow}
            </p>
            <p className="text-[6.5px] font-bold text-white">{d.fecha}</p>
          </div>
        ))}

        {GRILLA.map((fila, hi) => (
          <div key={HORAS[hi]} className="contents">
            <div
              className={`flex items-start justify-end px-1 py-1 text-[5.5px] font-medium text-neutral-400 ${
                hi % 2 === 1 ? "bg-accent-soft/40" : ""
              }`}
            >
              {HORAS[hi]}
            </div>
            {fila.map((turno, di) => (
              <div
                key={di}
                className={`border-l border-t border-neutral-100 p-[2px] ${
                  hi % 2 === 1 ? "bg-accent-soft/40" : ""
                }`}
              >
                {hi === 6 && di === 3 ? (
                  <TurnoCursorDemo nombre="Camila T." tipoDot={TIPOS[0].dot} />
                ) : turno ? (
                  <div className="flex items-start gap-1 rounded bg-neutral-100 px-1 py-[3px]">
                    <span
                      className={`mt-[1.5px] h-1 w-1 shrink-0 rounded-full ${TIPOS[turno.tipo].dot}`}
                    />
                    <span className="truncate text-[5.5px] font-semibold text-neutral-900">
                      {turno.nombre}
                    </span>
                  </div>
                ) : (
                  <div className="flex h-3 items-center justify-center rounded border border-dashed border-neutral-200 text-[5.5px] text-neutral-300">
                    +
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
