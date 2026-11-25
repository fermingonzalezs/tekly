"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOutsideClick } from "@/components/ui/use-outside-click";
import {
  BORRADOR_CLIENTE_VACIO,
  CamposCliente,
  datosDeBorrador,
  validarBorradorCliente,
  type BorradorCliente,
} from "@/components/clientes/campos-cliente";
import { isoAFechaDDMMAAAA } from "@/lib/clientes";
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
  /** Borrador del modal «Cliente nuevo» (abierto si no es `null`). Se abre
   * encima del formulario que usa el picker (ej. Nueva venta). */
  const [borrador, setBorrador] = useState<BorradorCliente | null>(null);
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false));

  const query = q.trim().toLowerCase();
  const matches = query ? clientes.filter((c) => c.nombre.toLowerCase().includes(query)) : clientes;

  function elegir(c: ClienteOpcion) {
    onChange({ tipo: "existente", id: c.id, nombre: c.nombre });
    setOpen(false);
    setQ("");
  }

  function abrirCrear() {
    setOpen(false);
    setBorrador({ ...BORRADOR_CLIENTE_VACIO, nombre: q.trim() });
  }

  /** Reabre el modal con los datos del cliente nuevo ya elegido. */
  function editarNuevo() {
    if (value?.tipo !== "nuevo") return;
    setBorrador({
      nombre: value.nombre,
      telefono: value.telefono ?? "",
      email: value.email ?? "",
      instagram: value.instagram ?? "",
      nacimiento: isoAFechaDDMMAAAA(value.fechaNacimiento),
    });
  }

  function confirmarCrear() {
    if (!borrador || !validarBorradorCliente(borrador).valido) return;
    onChange({ tipo: "nuevo", ...datosDeBorrador(borrador) });
    setBorrador(null);
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

  const modal = (
    <Dialog
      open={!!borrador}
      onClose={() => setBorrador(null)}
      title={value?.tipo === "nuevo" && borrador ? "Editar cliente nuevo" : "Cliente nuevo"}
      description="Se guarda en Clientes recién cuando confirmás la operación."
      size="lg"
      formulario
      footer={
        <>
          <Button onClick={() => setBorrador(null)} variant="outline" fullOnMobile className="sm:ml-auto">
            Cancelar
          </Button>
          <Button
            onClick={confirmarCrear}
            disabled={!borrador || !validarBorradorCliente(borrador).valido}
            variant="primary"
            fullOnMobile
          >
            Usar este cliente
          </Button>
        </>
      }
    >
      {borrador && <CamposCliente value={borrador} onChange={setBorrador} autoFocus />}
    </Dialog>
  );

  if (value && !open) {
    return (
      <>
        <div
          className={cn(
            "flex h-9 items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm",
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
          <span className="flex shrink-0 items-center gap-3">
            {value.tipo === "nuevo" && (
              <Button type="button" variant="link" size="sm" onClick={editarNuevo}>
                Editar datos
              </Button>
            )}
            <Button type="button" variant="link" size="sm" onClick={cambiar}>
              Cambiar
            </Button>
          </span>
        </div>
        {modal}
      </>
    );
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} placeholder={placeholder} />
      {open && (
        <div className="animate-menu-in origin-top absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
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
        </div>
      )}
      {modal}
    </div>
  );
}
