import { describe, expect, it } from "vitest";
import {
  cargosPagosPorMes,
  deudaPorCliente,
  saldoDe,
} from "@/lib/cuentas-corrientes";

const mov = (clienteId: string, tipo: "cargo" | "pago", montoUsd: number) => ({
  clienteId,
  tipo,
  montoUsd,
});

const conFecha = (
  clienteId: string,
  tipo: "cargo" | "pago",
  montoUsd: number,
  fechaISO: string,
) => ({ clienteId, tipo, montoUsd, fechaISO });

const cliente = (id: string, nombre: string) => ({ id, nombre });

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

describe("deudaPorCliente", () => {
  const clientes = [
    cliente("c-1", "Ana"),
    cliente("c-2", "Beto"),
    cliente("c-3", "Carla"),
  ];

  it("agrupa por cliente y ordena de mayor a menor deuda", () => {
    const r = deudaPorCliente(
      [
        mov("c-1", "cargo", 100),
        mov("c-2", "cargo", 500),
        mov("c-3", "cargo", 50),
      ],
      clientes,
    );
    expect(r.map((x) => [x.nombre, x.saldo])).toEqual([
      ["Beto", 500],
      ["Ana", 100],
      ["Carla", 50],
    ]);
  });

  it("excluye clientes al día o a favor", () => {
    const r = deudaPorCliente(
      [
        mov("c-1", "cargo", 100),
        mov("c-2", "cargo", 100),
        mov("c-2", "pago", 150),
        mov("c-3", "cargo", 80),
        mov("c-3", "pago", 80),
      ],
      clientes,
    );
    expect(r.map((x) => x.nombre)).toEqual(["Ana"]);
  });

  it("respeta el tope `top`", () => {
    const r = deudaPorCliente(
      [mov("c-1", "cargo", 100), mov("c-2", "cargo", 500), mov("c-3", "cargo", 50)],
      clientes,
      2,
    );
    expect(r).toHaveLength(2);
    expect(r[0].nombre).toBe("Beto");
  });

  it("sin movimientos da lista vacía", () => {
    expect(deudaPorCliente([], clientes)).toEqual([]);
  });
});

describe("cargosPagosPorMes", () => {
  it("agrupa cargos y pagos por mes, ascendente", () => {
    const r = cargosPagosPorMes([
      conFecha("c-1", "cargo", 100, "2026-09-07"),
      conFecha("c-1", "pago", 40, "2026-09-20"),
      conFecha("c-2", "cargo", 200, "2026-08-31"),
      conFecha("c-1", "cargo", 50, "2026-09-30"),
    ]);
    expect(r.labels).toEqual(["ago 2026", "sep 2026"]);
    expect(r.cargos).toEqual([200, 150]);
    expect(r.pagos).toEqual([0, 40]);
  });

  it("sin movimientos da series vacías", () => {
    expect(cargosPagosPorMes([])).toEqual({ labels: [], cargos: [], pagos: [] });
  });
});
