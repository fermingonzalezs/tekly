"use client";

import { useCallback, useEffect, useState } from "react";
import {
  guardarVisibilidad,
  leerVisibilidad,
  VISIBILIDAD_DEFAULT,
  type BloqueVisible,
  type VisibilidadBloques,
} from "@/lib/visibilidad-bloques";

/** Visibilidad (persistida en `localStorage`) de los bloques Gráficos y
 *  Tarjetas de una sección. El primer render (SSR incluido) siempre sale
 *  visible para no romper la hidratación; recién al montar se aplica lo
 *  guardado. */
export function useVisibilidadBloques(id: string) {
  const [estado, setEstado] = useState<VisibilidadBloques>(VISIBILIDAD_DEFAULT);

  useEffect(() => {
    setEstado(leerVisibilidad(id));
  }, [id]);

  const toggle = useCallback(
    (bloque: BloqueVisible) => {
      setEstado((prev) => {
        const next = { ...prev, [bloque]: !prev[bloque] };
        guardarVisibilidad(id, next);
        return next;
      });
    },
    [id],
  );

  return { graficos: estado.graficos, tarjetas: estado.tarjetas, toggle };
}
