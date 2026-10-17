import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Checkbox compacto para seleccionar filas. `tono="oscuro"` para usarlo
 *  sobre el encabezado índigo (tabla o tarjeta); `parcial` muestra el guion. */
export function CheckSeleccion({
  checked,
  onChange,
  label,
  tono = "claro",
  parcial = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  tono?: "claro" | "oscuro";
  parcial?: boolean;
}) {
  const activo = checked || parcial;
  const Icono = parcial && !checked ? Minus : Check;
  return (
    <label
      className="relative inline-grid h-4 w-4 shrink-0 cursor-pointer place-items-center"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={onChange}
        className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-[5px] outline-none"
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[5px] border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 peer-focus-visible:ring-offset-1",
          tono === "oscuro"
            ? activo
              ? "border-white bg-white"
              : "border-white/60 bg-transparent"
            : activo
              ? "border-accent bg-accent"
              : "border-neutral-300 bg-white",
        )}
      />
      {activo && (
        <Icono
          aria-hidden="true"
          strokeWidth={3}
          className={cn(
            "pointer-events-none relative h-3 w-3",
            tono === "oscuro" ? "text-accent" : "text-white",
          )}
        />
      )}
    </label>
  );
}
