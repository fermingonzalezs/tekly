import { MockupChrome } from "./mockup-chrome";

/**
 * Ilustración de /inventario (tab Equipos) para el carousel de módulos:
 * mismas convenciones de escala que el resto de los mockups "ventana
 * completa" (5-6.5px de texto, header de tabla en banda índigo, zebra cada
 * fila impar). Estados con el tono real de `equipoStatus` (`lib/status.ts`):
 * disponible=emerald, reservado=blue, en_revision=amber, vendido=gris. Sin
 * "extraviado" a propósito -- es el caso raro, no lo que se quiere mostrar
 * primero. Inventario vive dentro de "Stock" en el topnav real, por eso esa
 * es la pill activa.
 */

const EQUIPOS = [
  { modelo: "iPhone 13 Pro", gb: "256GB", imei: "35824012345671", estado: "Disponible", dot: "bg-emerald-500" },
  { modelo: "iPhone 12", gb: "128GB", imei: "35824012345672", estado: "Vendido", dot: "bg-neutral-400" },
  { modelo: "iPhone 14", gb: "128GB", imei: "35824012345673", estado: "Reservado", dot: "bg-blue-500" },
  { modelo: "iPhone 11", gb: "64GB", imei: "35824012345674", estado: "En revisión", dot: "bg-amber-500" },
  { modelo: "iPhone SE (2022)", gb: "64GB", imei: "35824012345675", estado: "Disponible", dot: "bg-emerald-500" },
  { modelo: "iPhone 13", gb: "128GB", imei: "35824012345676", estado: "Vendido", dot: "bg-neutral-400" },
  { modelo: "iPhone 15", gb: "256GB", imei: "35824012345677", estado: "Disponible", dot: "bg-emerald-500" },
  { modelo: "iPhone 12 Mini", gb: "64GB", imei: "35824012345678", estado: "Reservado", dot: "bg-blue-500" },
  { modelo: "iPhone 14 Pro", gb: "256GB", imei: "35824012345679", estado: "Disponible", dot: "bg-emerald-500" },
  { modelo: "iPhone XR", gb: "64GB", imei: "35824012345680", estado: "Vendido", dot: "bg-neutral-400" },
  { modelo: "iPhone 13 Pro Max", gb: "512GB", imei: "35824012345681", estado: "Disponible", dot: "bg-emerald-500" },
  { modelo: "iPhone 12 Pro", gb: "128GB", imei: "35824012345682", estado: "En revisión", dot: "bg-amber-500" },
  { modelo: "iPhone 15 Pro", gb: "256GB", imei: "35824012345683", estado: "Reservado", dot: "bg-blue-500" },
  { modelo: "iPhone 11 Pro", gb: "64GB", imei: "35824012345684", estado: "Disponible", dot: "bg-emerald-500" },
  { modelo: "iPhone 12", gb: "256GB", imei: "35824012345685", estado: "Vendido", dot: "bg-neutral-400" },
  { modelo: "iPhone 14 Plus", gb: "128GB", imei: "35824012345686", estado: "Disponible", dot: "bg-emerald-500" },
  { modelo: "iPhone 13 mini", gb: "128GB", imei: "35824012345687", estado: "Reservado", dot: "bg-blue-500" },
  { modelo: "iPhone XS", gb: "64GB", imei: "35824012345688", estado: "En revisión", dot: "bg-amber-500" },
];

export function MockupInventario({ className }: { className?: string }) {
  return (
    <div
      className={`flex aspect-video flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-accent/10 ${className ?? ""}`}
      aria-hidden="true"
    >
      <MockupChrome activo="Stock" />

      <div className="flex items-center gap-1 border-b border-neutral-100 px-3 py-1.5">
        <span className="rounded-full border border-accent bg-white px-1.5 py-[3px] text-[5px] font-medium text-accent">
          Equipos
        </span>
        <span className="rounded-full border border-transparent px-1.5 py-[3px] text-[5px] font-medium text-neutral-500">
          Repuestos
        </span>
        <span className="rounded-full border border-transparent px-1.5 py-[3px] text-[5px] font-medium text-neutral-500">
          Otros
        </span>
        <span className="ml-auto flex items-center gap-0.5 rounded-full border border-accent/40 px-1.5 py-[3px] text-[5px] font-semibold text-accent">
          + Agregar equipo
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: "1fr 44px 76px 54px" }}>
          <div className="bg-table-header px-1.5 py-1 text-[5px] font-bold uppercase tracking-wide text-white">
            Modelo
          </div>
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            Alm.
          </div>
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            IMEI
          </div>
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            Estado
          </div>

          {EQUIPOS.map((e, i) => (
            <div key={e.imei} className="contents">
              <div
                className={`truncate border-t border-neutral-100 px-1.5 py-1 text-[5.5px] font-medium text-neutral-900 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                {e.modelo}
              </div>
              <div
                className={`border-t border-neutral-100 px-1 py-1 text-center text-[5.5px] text-neutral-500 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                {e.gb}
              </div>
              <div
                className={`border-t border-neutral-100 px-1 py-1 text-center text-[5px] tabular-nums text-neutral-400 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                {e.imei}
              </div>
              <div
                className={`border-t border-neutral-100 px-1 py-1 text-center ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                <span className="inline-flex items-center gap-0.5 rounded bg-neutral-100 px-1 py-[1px] text-[5px] font-medium text-neutral-700">
                  <span className={`h-1 w-1 rounded-full ${e.dot}`} />
                  {e.estado}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
