"use client";

import { useDolar } from "@/lib/dolar";
import { fmtArs } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DolarNavbar() {
  const d = useDolar();
  return (
    <div
      title={
        d.fuente === "api"
          ? `dolarapi.com${d.actualizado ? ` · ${new Date(d.actualizado).toLocaleString("es-AR")}` : ""}`
          : "Sin conexión con dolarapi.com — valor de referencia"
      }
      className="hidden items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 md:flex"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        Dólar blue
      </span>
      <span className="text-sm font-semibold tabular-nums text-neutral-800">
        {fmtArs(d.venta)}
      </span>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          d.fuente === "api" ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
    </div>
  );
}
