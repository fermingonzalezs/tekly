// `useGrouping: "always"`: el locale es-AR por default NO agrupa los números
// de 4 dígitos ("1465" en vez de "1.465"); así el punto de miles aparece siempre.
const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
  useGrouping: "always",
});
const num = new Intl.NumberFormat("es-AR", { useGrouping: "always" });
const num1 = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
  useGrouping: "always",
});

/** Montos en dólares: "U$ 48.250" (separador de miles con punto, es-AR). */
export const fmtUsd = (n: number) =>
  `U$ ${num.format(Math.round(n))}`;

export const fmtArs = (n: number) => ars.format(n);
export const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
export const fmtNum = (n: number) => num.format(n);
/** Un decimal máximo, con miles agrupados ("12.345,6"). */
export const fmtNum1 = (n: number) => num1.format(n);

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

/** "2026-09-17" (o con hora, se recorta) -> "17/09/2026" -- N.º/fecha de
 * los recibos. String, nunca `new Date().getDate()` -- mismo cuidado de
 * huso horario que `fechaISO` en `lib/analiticas.ts`. */
export const fmtDateSlash = (isoDate: string) => {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/** "2026-09-07T14:32..." -> "14:32". */
export const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
