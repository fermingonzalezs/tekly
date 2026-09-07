const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export const fmtUsd = (n: number) => usd.format(n);
export const fmtArs = (n: number) => ars.format(n);
export const fmtPct = (n: number) =>
  `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
