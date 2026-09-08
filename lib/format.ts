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

/** Usuario "logueado" fijo para el MVP (sin auth real). */
export const currentUser = {
  nombre: "Fermín G.",
  rol: "Admin",
  iniciales: "FG",
};
