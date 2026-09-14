import { describe, expect, it } from "vitest";
import { saldoDe } from "@/lib/cuentas-corrientes";

const mov = (clienteId: string, tipo: "cargo" | "pago", montoUsd: number) => ({
  clienteId,
  tipo,
  montoUsd,
});

describe("saldoDe", () => {
  it("sin movimientos da 0", () => {
    expect(saldoDe([], "c-1")).toBe(0);
  });
  it("un cargo aumenta el saldo (deuda)", () => {
    expect(saldoDe([mov("c-1", "cargo", 100)], "c-1")).toBe(100);
  });
  it("un pago reduce el saldo", () => {
    expect(saldoDe([mov("c-1", "cargo", 100), mov("c-1", "pago", 40)], "c-1")).toBe(60);
  });
  it("pagar de más deja saldo a favor (negativo)", () => {
    expect(saldoDe([mov("c-1", "cargo", 50), mov("c-1", "pago", 80)], "c-1")).toBe(-30);
  });
  it("ignora movimientos de otros clientes", () => {
    expect(saldoDe([mov("c-1", "cargo", 100), mov("c-2", "cargo", 999)], "c-1")).toBe(100);
  });
});
