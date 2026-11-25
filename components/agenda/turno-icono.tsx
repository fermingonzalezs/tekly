import { Calculator, PackageCheck, ShoppingBag, Wrench, type LucideIcon } from "lucide-react";
import type { TurnoTipo } from "@/lib/types";

/** Ícono por motivo del turno: es lo que deja leer de un vistazo qué tipo de
 * turno es (bloques de la grilla, mes, Próximos y leyenda). */
export const TURNO_ICONO: Record<TurnoTipo, LucideIcon> = {
  compra: ShoppingBag,
  deja: Wrench,
  retira: PackageCheck,
  cotizar: Calculator,
};
