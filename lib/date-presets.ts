export type DatePreset = "todos" | "mes" | "mes_anterior" | "15dias" | "personalizado";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "todos", label: "Todas las fechas" },
  { value: "mes", label: "Este mes" },
  { value: "mes_anterior", label: "Mes anterior" },
  { value: "15dias", label: "Últimos 15 días" },
  { value: "personalizado", label: "Rango personalizado" },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Rango `{ desde, hasta }` (ISO) para un preset, o `null` para "todos" /
 * "personalizado" (ese último usa las fechas que eligió el usuario). */
export function presetRange(
  preset: DatePreset,
): { desde: string; hasta: string } | null {
  const now = new Date();
  if (preset === "mes") {
    return {
      desde: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      hasta: isoDate(now),
    };
  }
  if (preset === "mes_anterior") {
    return {
      desde: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      hasta: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (preset === "15dias") {
    const from = new Date(now);
    from.setDate(from.getDate() - 15);
    return { desde: isoDate(from), hasta: isoDate(now) };
  }
  return null;
}
