"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/field";
import { useOutsideClick } from "@/components/ui/use-outside-click";
import { cn } from "@/lib/utils";
import type { ClienteOpcion, ClienteSeleccion } from "@/lib/types";

/** Desplegable con buscador para elegir un cliente existente o crear uno
 * nuevo -- reemplaza los `<Select>`/inputs ad-hoc que había en cada
 * sección. La creación queda diferida: elegir "Crear cliente nuevo" solo
 * arma el borrador (`{ tipo: "nuevo", ... }`); recién se persiste (vía
 * `resolveCliente` en `lib/db/clientes.ts`) cuando el formulario que usa
 * este picker confirma su propia acción -- así cancelar ese formulario no
 * deja un cliente fantasma, mismo criterio que ya usaba "Nueva venta".
 *
 * `allowLibre` agrega una tercera opción, "usar sin registrar" (solo un
 * nombre suelto, sin fila en `clientes`) -- hoy solo la necesita Turnos,
 * donde a veces el cliente todavía no está dado de alta. */
export function ClientePicker({
  clientes,
  value,
  onChange,
  allowLibre = false,
  placeholder = "Buscar cliente…",
  className,
}: {
  clientes: ClienteOpcion[];
  value: ClienteSeleccion | null;
  onChange: (sel: ClienteSeleccion | null) => void;
  allowLibre?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTel, setNuevoTel] = useState("");
  const ref = useOutsideClick<HTMLDivElement>(() => {
    setOpen(false);
    setCreando(false);
  });

  const query = q.trim().toLowerCase();
  const matches = query ? clientes.filter((c) => c.nombre.toLowerCase().includes(query)) : clientes;

  function elegir(c: ClienteOpcion) {
    onChange({ tipo: "existente", id: c.id, nombre: c.nombre });
    setOpen(false);
    setQ("");
  }

  function abrirCrear() {
    setNuevoNombre(q.trim());
    setNuevoTel("");
    setCreando(true);
  }

  function confirmarCrear() {
    if (!nuevoNombre.trim()) return;
    onChange({ tipo: "nuevo", nombre: nuevoNombre.trim(), telefono: nuevoTel.trim() || undefined });
    setOpen(false);
    setCreando(false);
    setQ("");
  }

  function usarLibre() {
    if (!q.trim()) return;
    onChange({ tipo: "libre", nombre: q.trim() });
    setOpen(false);
    setQ("");
  }

  function cambiar() {
    onChange(null);
    setQ("");
    setOpen(true);
  }

  if (value && !open) {
    return (
      <div
        className={cn(
          "flex h-9 items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm",
          className,
        )}
      >
        <span className="truncate">
          {value.nombre}
          {value.tipo === "nuevo" && <span className="ml-1.5 text-[11px] text-accent">(nuevo)</span>}
          {value.tipo === "libre" && (
            <span className="ml-1.5 text-[11px] text-neutral-400">(sin registrar)</span>
          )}
        </span>
        <button
          type="button"
          onClick={cambiar}
          className="shrink-0 text-xs font-medium text-accent hover:underline"
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} placeholder={placeholder} />
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          {creando ? (
            <div className="space-y-2 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Cliente nuevo
              </p>
              <Input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Nombre"
                autoFocus
              />
              <Input
                value={nuevoTel}
                onChange={(e) => setNuevoTel(e.target.value)}
                placeholder="Teléfono (opcional)"
              />
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setCreando(false)}
                  className="text-xs font-medium text-neutral-500 hover:underline"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={confirmarCrear}
                  disabled={!nuevoNombre.trim()}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
                >
                  Usar este cliente
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-56 overflow-y-auto">
                {matches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => elegir(c)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  >
                    <span className="font-medium">{c.nombre}</span>
                    <span className="text-xs text-neutral-400">{c.telefono}</span>
                  </button>
                ))}
                {matches.length === 0 && (
                  <p className="px-3 py-2 text-xs text-neutral-400">Sin resultados.</p>
                )}
              </div>
              <div className="border-t border-neutral-100 p-1">
                <button
                  type="button"
                  onClick={abrirCrear}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-accent hover:bg-accent-soft"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crear cliente nuevo{q.trim() ? `: «${q.trim()}»` : ""}
                </button>
                {allowLibre && q.trim() && (
                  <button
                    type="button"
                    onClick={usarLibre}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-neutral-500 hover:bg-neutral-50"
                  >
                    Usar «{q.trim()}» sin registrar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
