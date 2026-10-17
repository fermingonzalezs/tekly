"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";

type Estado = "idle" | "ok" | "error";

/** Copia al portapapeles y expone el estado un instante (ok / error). */
function useCopiar(texto: string | (() => string)) {
  const [estado, setEstado] = useState<Estado>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copiar(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(typeof texto === "function" ? texto() : texto);
      setEstado("ok");
    } catch {
      setEstado("error");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setEstado("idle"), 1600);
  }

  return { estado, copiar };
}

/** Botón de ícono que copia un texto al portapapeles (ej. la ficha «para
 *  publicar» de un celular o una notebook). Muestra un check un instante al
 *  copiar y una alerta si el navegador no dio permiso. Sirve dentro de una
 *  fila clickeable: frena el click para no abrir el detalle. */
export function CopiarTexto({
  texto,
  label = "Copiar texto para publicar",
  conTexto = false,
  fullOnMobile,
}: {
  texto: string;
  /** `aria-label` / tooltip. */
  label?: string;
  /** Muestra «Copiar texto» al lado del ícono (para diálogos). */
  conTexto?: boolean;
  fullOnMobile?: boolean;
}) {
  const { estado, copiar } = useCopiar(texto);
  const Icono = estado === "ok" ? Check : estado === "error" ? AlertTriangle : Copy;
  const title = estado === "error" ? "El navegador no permitió copiar" : label;

  if (!conTexto) {
    return (
      <IconButton
        icon={Icono}
        size="sm"
        shape="square"
        onClick={copiar}
        aria-label={label}
        title={title}
      />
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      icon={Icono}
      onClick={copiar}
      aria-label={label}
      title={title}
      fullOnMobile={fullOnMobile}
    >
      {estado === "ok" ? "¡Copiado!" : estado === "error" ? "No se pudo copiar" : "Copiar texto"}
    </Button>
  );
}

/** Copia varios textos juntos (uno por línea en blanco) — selección múltiple
 *  de Inventario. */
export function CopiarSeleccion({
  textos,
  onLimpiar,
}: {
  textos: () => string[];
  onLimpiar: () => void;
}) {
  const n = textos().length;
  const { estado, copiar } = useCopiar(() => textos().join("\n\n"));
  const Icono = estado === "ok" ? Check : estado === "error" ? AlertTriangle : Copy;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="tonal" size="sm" icon={Icono} onClick={copiar}>
        {estado === "ok"
          ? "¡Copiado!"
          : estado === "error"
            ? "No se pudo copiar"
            : `Copiar ${n} seleccionado${n === 1 ? "" : "s"}`}
      </Button>
      <Button variant="ghost" size="sm" onClick={onLimpiar}>
        Quitar selección
      </Button>
    </div>
  );
}
