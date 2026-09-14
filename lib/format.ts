const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** Montos en dólares: "U$ 48.250" (separador de miles con punto, es-AR). */
export const fmtUsd = (n: number) =>
  `U$ ${Math.round(n).toLocaleString("es-AR")}`;

export const fmtArs = (n: number) => ars.format(n);
export const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
export const fmtNum = (n: number) => n.toLocaleString("es-AR");

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** "2023-03-14T..." -> "mar 2023" -- formato de "cliente desde" / "caja
 * creada el" en toda la app. */
export const fmtMonthYear = (iso: string) => {
  const d = new Date(iso);
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
};

/** "2026-09-07T..." -> "07 sep" -- formato de fecha corta en logs de
 * movimientos (inventario, cajas, cuentas corrientes). */
export const fmtDayMonth = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MESES[d.getMonth()]}`;
};

/** "2026-09-07T14:32..." -> "14:32". */
export const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
