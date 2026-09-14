import { describe, expect, it } from "vitest";
import { enArs, netoMovimientos, signo } from "@/lib/cajas";

describe("signo", () => {
  it("un ingreso suma", () => {
    expect(signo({ tipo: "ingreso", monto: 100 })).toBe(100);
  });
  it("un egreso resta", () => {
    expect(signo({ tipo: "egreso", monto: 100 })).toBe(-100);
  });
});

describe("netoMovimientos", () => {
  it("sin movimientos da 0", () => {
    expect(netoMovimientos([])).toBe(0);
  });
  it("neta ingresos y egresos", () => {
    const neto = netoMovimientos([
      { tipo: "ingreso", monto: 500 },
      { tipo: "egreso", monto: 200 },
      { tipo: "ingreso", monto: 50 },
    ]);
    expect(neto).toBe(350);
  });
});

describe("enArs", () => {
  it("un monto en ars queda igual", () => {
    expect(enArs(1000, "ars", 1465)).toBe(1000);
  });
  it("un monto en usd se convierte con la cotización", () => {
    expect(enArs(10, "usd", 1465)).toBe(14650);
  });
});
