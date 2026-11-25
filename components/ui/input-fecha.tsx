"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/field";
import { fechaDDMMAAAAaIso, isoAFechaDDMMAAAA, maskFechaDDMMAAAA } from "@/lib/clientes";
import { cn } from "@/lib/utils";

/** "2026-02-31" no existe aunque pase el regex: se valida contra el calendario. */
function isoValida(iso: string | undefined): iso is string {
  if (!iso) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** Fecha en DD/MM/AAAA en toda la app. El `<input type="date">` nativo usa
 * el idioma del navegador (en inglés sale MM/DD/AAAA aunque la página sea
 * es-AR), así que se escribe en un input de texto con máscara y el
 * calendario nativo se abre desde el botón. `value`/`onChange` siguen en ISO
 * (`YYYY-MM-DD`, `""` = vacía), igual que antes. */
export function InputFecha({
  value,
  onChange,
  className,
  inputClassName,
  min,
  max,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (iso: string) => void;
  /** Contenedor: ancho/posición en la grilla. */
  className?: string;
  /** El input visible (ej. `filterPill` en barras de filtros). */
  inputClassName?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [texto, setTexto] = useState(() => isoAFechaDDMMAAAA(value));
  const nativo = useRef<HTMLInputElement>(null);

  // Cambio desde afuera (preset, reset del form): se refleja en el texto.
  useEffect(() => {
    const actual = fechaDDMMAAAAaIso(texto) ?? "";
    if (actual !== value) setTexto(isoAFechaDDMMAAAA(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function escribir(raw: string) {
    const enmascarado = maskFechaDDMMAAAA(raw);
    setTexto(enmascarado);
    if (enmascarado === "") return onChange("");
    const iso = fechaDDMMAAAAaIso(enmascarado);
    if (isoValida(iso)) onChange(iso);
  }

  function abrirCalendario() {
    const el = nativo.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        value={texto}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => escribir(e.target.value)}
        // Fecha incompleta o inexistente al salir: vuelve al último valor válido.
        onBlur={() => setTexto(isoAFechaDDMMAAAA(value))}
        className={cn("pr-9 tabular-nums", inputClassName)}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Abrir calendario"
        onClick={abrirCalendario}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-neutral-400 transition-colors hover:text-accent disabled:pointer-events-none"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      {/* Solo para el calendario nativo; invisible y fuera del foco. */}
      <input
        ref={nativo}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          setTexto(isoAFechaDDMMAAAA(e.target.value));
          onChange(e.target.value);
        }}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
      />
    </div>
  );
}
