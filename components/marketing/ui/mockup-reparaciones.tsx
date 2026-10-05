import { MockupChrome } from "./mockup-chrome";

/**
 * Ilustración de /reparaciones (tab Tickets) para el carousel de módulos:
 * mismo criterio de escala y zebra que el resto. El pipeline de 5
 * StatCards usa el tono real de `ticketStatus` (`lib/status.ts`): recibido/
 * entregado=gris, diagnosticado/en_reparacion=blue, esperando_repuesto=amber,
 * listo=green. "Reparaciones" es su propia categoría del topnav (no vive
 * agrupada bajo otra), así que esa es la pill activa.
 */

const PIPELINE = [
  { label: "Recibido", valor: 4, dot: "bg-neutral-400" },
  { label: "En reparación", valor: 6, dot: "bg-blue-500" },
  { label: "Esperando repuesto", valor: 2, dot: "bg-amber-500" },
  { label: "Listo", valor: 3, dot: "bg-emerald-500" },
  { label: "Entregado", valor: 9, dot: "bg-neutral-400" },
];

const TICKETS = [
  { cliente: "Diego Sánchez", equipo: "iPhone 13", falla: "Pantalla rota", tecnico: "Meli", estado: "Recibido", dot: "bg-neutral-400" },
  { cliente: "Valentina López", equipo: "iPhone 12", falla: "No carga", tecnico: "Caro", estado: "En reparación", dot: "bg-blue-500" },
  { cliente: "Nicolás Rodríguez", equipo: "iPhone 11", falla: "Botón home", tecnico: "Meli", estado: "Esperando repuesto", dot: "bg-amber-500" },
  { cliente: "Lucía Fernández", equipo: "iPhone 14 Pro", falla: "Cámara trasera", tecnico: "Caro", estado: "Listo", dot: "bg-emerald-500" },
  { cliente: "Martín Gómez", equipo: "iPhone XR", falla: "No enciende", tecnico: "Meli", estado: "En reparación", dot: "bg-blue-500" },
  { cliente: "Sofía Martínez", equipo: "iPhone 13 Mini", falla: "Batería", tecnico: "Caro", estado: "Entregado", dot: "bg-neutral-400" },
  { cliente: "Julieta Romero", equipo: "iPhone 12 Pro", falla: "Altavoz", tecnico: "Meli", estado: "Recibido", dot: "bg-neutral-400" },
  { cliente: "F. Gonzalez Sardi", equipo: "iPhone SE", falla: "Puerto de carga", tecnico: "Caro", estado: "Listo", dot: "bg-emerald-500" },
  { cliente: "Agustín Molina", equipo: "iPhone 14", falla: "Pin de carga", tecnico: "Meli", estado: "En reparación", dot: "bg-blue-500" },
  { cliente: "Bruno Acosta", equipo: "iPhone XR", falla: "Micrófono", tecnico: "Caro", estado: "Recibido", dot: "bg-neutral-400" },
  { cliente: "Camila Torres", equipo: "iPhone 11 Pro", falla: "Tapa trasera", tecnico: "Meli", estado: "Entregado", dot: "bg-neutral-400" },
  { cliente: "Federico Díaz", equipo: "iPhone 12 Pro", falla: "Flex de volumen", tecnico: "Caro", estado: "Esperando repuesto", dot: "bg-amber-500" },
  { cliente: "Valentina Cruz", equipo: "iPhone 13 Pro", falla: "Pantalla rota", tecnico: "Meli", estado: "En reparación", dot: "bg-blue-500" },
  { cliente: "Marco Díaz", equipo: "iPhone 12 Mini", falla: "Sensor de huella", tecnico: "Caro", estado: "Recibido", dot: "bg-neutral-400" },
  { cliente: "Rocío Benítez", equipo: "iPhone 14 Plus", falla: "Vidrio trasero", tecnico: "Meli", estado: "Listo", dot: "bg-emerald-500" },
];

export function MockupReparaciones({ className }: { className?: string }) {
  return (
    <div
      className={`flex aspect-video flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-accent/10 ${className ?? ""}`}
      aria-hidden="true"
    >
      <MockupChrome activo="Reparaciones" />

      <div className="flex gap-1 border-b border-neutral-100 px-3 py-1.5">
        <span className="rounded-full border border-accent bg-white px-1.5 py-[3px] text-[5px] font-medium text-accent">
          Tickets
        </span>
        <span className="rounded-full border border-transparent px-1.5 py-[3px] text-[5px] font-medium text-neutral-500">
          Servicios
        </span>
        <span className="ml-auto flex items-center gap-0.5 rounded-full border border-accent/40 px-1.5 py-[3px] text-[5px] font-semibold text-accent">
          + Nuevo ticket
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1 px-3 py-2">
        {PIPELINE.map((p) => (
          <div key={p.label} className="rounded-md border border-neutral-200 p-1">
            <p className="flex items-center gap-0.5 truncate text-[5px] font-semibold uppercase tracking-wide text-neutral-400">
              <span className={`h-1 w-1 shrink-0 rounded-full ${p.dot}`} />
              {p.label}
            </p>
            <p className="font-grotesk text-[7px] font-bold tabular-nums text-neutral-900">
              {p.valor}
            </p>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden border-t border-neutral-100">
        <div className="grid" style={{ gridTemplateColumns: "60px 56px 1fr 30px 66px" }}>
          <div className="bg-table-header px-1.5 py-1 text-[5px] font-bold uppercase tracking-wide text-white">
            Cliente
          </div>
          <div className="bg-table-header px-1 py-1 text-[5px] font-bold uppercase tracking-wide text-white">
            Equipo
          </div>
          <div className="bg-table-header px-1.5 py-1 text-[5px] font-bold uppercase tracking-wide text-white">
            Falla
          </div>
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            Téc.
          </div>
          <div className="bg-table-header px-1 py-1 text-center text-[5px] font-bold uppercase tracking-wide text-white">
            Estado
          </div>

          {TICKETS.map((t, i) => (
            <div key={t.cliente + t.falla} className="contents">
              <div
                className={`truncate border-t border-neutral-100 px-1.5 py-1 text-[5.5px] text-neutral-700 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                {t.cliente}
              </div>
              <div
                className={`truncate border-t border-neutral-100 px-1 py-1 text-[5.5px] text-neutral-500 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                {t.equipo}
              </div>
              <div
                className={`truncate border-t border-neutral-100 px-1.5 py-1 text-[5.5px] font-medium text-neutral-900 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                {t.falla}
              </div>
              <div
                className={`border-t border-neutral-100 px-1 py-1 text-center text-[5px] text-neutral-500 ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                {t.tecnico}
              </div>
              <div
                className={`border-t border-neutral-100 px-1 py-1 text-center ${i % 2 === 1 ? "bg-accent-soft/40" : ""}`}
              >
                <span className="inline-flex items-center gap-0.5 rounded bg-neutral-100 px-1 py-[1px] text-[5px] font-medium text-neutral-700">
                  <span className={`h-1 w-1 rounded-full ${t.dot}`} />
                  {t.estado}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
