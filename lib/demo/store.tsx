"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Venta } from "@/lib/types";
import { crearSeedDemo, type DemoState } from "@/lib/demo/seed";
import {
  crearVentaDemo,
  eliminarVentaDemo,
  type CrearVentaDemoInput,
} from "@/lib/demo/operaciones";

/** Clave de `sessionStorage`. Versionar si cambia el shape del seed/estado. */
const STORAGE_KEY = "tekly:demo:v1";

/** Opciones de borrado -- mismas que `DeleteVentaOpts` de `lib/db/ventas.ts`,
 * copiadas acá para no importar un módulo `server-only`. */
export type OpcionesEliminar = {
  restituirEquipos: boolean;
  restituirRepuestos: boolean;
  eliminarMovimientosCaja: boolean;
  eliminarMovimientoCC: boolean;
  eliminarCompraCanje: boolean;
};

type DemoCtx = {
  state: DemoState;
  crearVenta: (input: CrearVentaDemoInput) => Promise<Venta>;
  eliminarVenta: (id: string, opts: OpcionesEliminar) => Promise<void>;
  reiniciar: () => void;
};

const Ctx = createContext<DemoCtx | null>(null);

function leerStorage(): DemoState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoState;
  } catch {
    return null;
  }
}

function escribirStorage(state: DemoState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Cuota llena / modo privado: se degrada a solo-memoria sin romper.
  }
}

/**
 * Estado de la demo (plan 014), 100 % en el navegador. El primer render (SSR
 * incluido) usa el seed para no romper la hidratación; recién en un
 * `useEffect` se reemplaza por lo guardado en `sessionStorage`.
 */
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(() => crearSeedDemo(new Date()));
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    const guardado = leerStorage();
    if (guardado) setState(guardado);
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    escribirStorage(state);
  }, [state, hidratado]);

  const value = useMemo<DemoCtx>(
    () => ({
      state,
      crearVenta: async (input) => {
        const { state: next, venta } = crearVentaDemo(state, input, new Date());
        setState(next);
        return venta;
      },
      eliminarVenta: async (id, opts) => {
        setState((prev) =>
          eliminarVentaDemo(prev, id, {
            restituirEquipos: opts.restituirEquipos,
            restituirRepuestos: opts.restituirRepuestos,
          }),
        );
      },
      reiniciar: () => setState(crearSeedDemo(new Date())),
    }),
    [state],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo(): DemoCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDemo() tiene que usarse dentro de <DemoProvider>");
  return ctx;
}
