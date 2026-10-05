"use client";

import { CHECKLIST_ITEMS, checklistItemLabel } from "@/lib/status";
import { Button } from "@/components/ui/button";
import type { Checklist, EstadoChecklistItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CHECKLIST_VACIO: Checklist = { items: {}, color: "" };

const ESTADO_BTN_ACTIVO: Record<EstadoChecklistItem, string> = {
  bien: "bg-emerald-500 text-white",
  mal: "bg-red-500 text-white",
  na: "bg-neutral-400 text-white",
};

/** Editor del checklist de estado físico/funcional -- 22 ítems fijos
 * (bien/mal/n-a) + color suelto. Reusado en Reparaciones ("Nuevo ticket" /
 * "Completar checklist de egreso") y en Ventas (equipo recibido en
 * canje). */
export function ChecklistEditor({
  value,
  onChange,
  gridClassName = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
}: {
  value: Checklist;
  onChange: (next: Checklist) => void;
  /** Columnas de la grilla de ítems (default 1→2→3). En un modal ancho o en
   * media columna conviene fijarlas explícitamente. */
  gridClassName?: string;
}) {
  const marcarTodo = (estado: EstadoChecklistItem) =>
    onChange({
      ...value,
      items: Object.fromEntries(CHECKLIST_ITEMS.map((id) => [id, estado])) as Checklist["items"],
    });

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => marcarTodo("bien")}>
          Marcar todo bien
        </Button>
        <Button variant="outline" size="sm" onClick={() => marcarTodo("na")}>
          No se testeó
        </Button>
      </div>
      <div className={cn("grid gap-2", gridClassName)}>
        {CHECKLIST_ITEMS.map((id) => (
          <div key={id} className="rounded-lg border border-neutral-200 px-3 py-2">
            <p className="mb-1.5 truncate text-sm text-neutral-700">{checklistItemLabel[id]}</p>
            <div className="flex gap-1">
              {(["bien", "mal", "na"] as const).map((estado) => (
                <button
                  key={estado}
                  type="button"
                  onClick={() =>
                    onChange({ ...value, items: { ...value.items, [id]: estado } })
                  }
                  className={cn(
                    "flex-1 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                    value.items[id] === estado
                      ? ESTADO_BTN_ACTIVO[estado]
                      : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200",
                  )}
                >
                  {estado === "bien" ? "Bien" : estado === "mal" ? "Mal" : "No aplica"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
