import "server-only";

/** Cotización del dólar blue en el **server** (para valuar el Patrimonio a
 *  hoy). `lib/dolar.ts` es solo cliente (`useDolar`), así que no se puede
 *  importar acá. Mismo endpoint y fallback que ese archivo; cachea 300 s
 *  (`revalidate`) para no pegarle a dolarapi.com en cada request. */

export type DolarServer = {
  compra: number;
  venta: number;
  fuente: "api" | "fallback";
  /** ISO de `fechaActualizacion` de la API, si vino. */
  actualizado?: string;
};

/** Valor de referencia si la API no responde -- igual que `lib/dolar.ts`. */
const FALLBACK: DolarServer = { compra: 1445, venta: 1465, fuente: "fallback" };

export async function getDolarServer(): Promise<DolarServer> {
  try {
    const r = await fetch("https://dolarapi.com/v1/dolares/blue", {
      next: { revalidate: 300 },
    });
    if (!r.ok) return FALLBACK;
    const d = (await r.json()) as {
      compra?: number;
      venta?: number;
      fechaActualizacion?: string;
    };
    if (typeof d.venta !== "number" || !Number.isFinite(d.venta) || d.venta <= 0) {
      return FALLBACK;
    }
    return {
      compra: typeof d.compra === "number" ? d.compra : d.venta,
      venta: d.venta,
      fuente: "api",
      actualizado: d.fechaActualizacion,
    };
  } catch {
    return FALLBACK;
  }
}
