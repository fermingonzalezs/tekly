"use client";

import { useEffect, useState } from "react";

export type Dolar = {
  compra: number;
  venta: number;
  fuente: "api" | "fallback";
  actualizado?: string;
};

/** Valor de referencia si la API no responde. */
const FALLBACK: Dolar = { compra: 1445, venta: 1465, fuente: "fallback" };

// Cache en memoria: la primera pantalla que lo trae lo deja para las demás.
let cache: Dolar = FALLBACK;
let inFlight: Promise<Dolar> | null = null;

async function fetchDolar(): Promise<Dolar> {
  const r = await fetch("https://dolarapi.com/v1/dolares/blue", {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(String(r.status));
  const d = (await r.json()) as {
    compra: number;
    venta: number;
    fechaActualizacion?: string;
  };
  return {
    compra: d.compra,
    venta: d.venta,
    fuente: "api",
    actualizado: d.fechaActualizacion,
  };
}

/** Último valor conocido (para cálculos fuera de React). */
export const getDolar = () => cache;

/** Hook: devuelve la cotización (blue) y la refresca desde dolarapi.com. */
export function useDolar() {
  const [dolar, setDolar] = useState<Dolar>(cache);

  useEffect(() => {
    let alive = true;
    inFlight ??= fetchDolar();
    inFlight
      .then((d) => {
        cache = d;
        if (alive) setDolar(d);
      })
      .catch(() => {
        if (alive) setDolar(cache);
      })
      .finally(() => {
        inFlight = null;
      });
    return () => {
      alive = false;
    };
  }, []);

  return dolar;
}
