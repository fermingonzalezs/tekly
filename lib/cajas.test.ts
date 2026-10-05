import { describe, expect, it } from "vitest";
import {
  diferenciaDeLinea,
  diferenciaPorCaja,
  diferenciaPorConciliacion,
  enArs,
  ingresosEgresosPorDia,
  netoMovimientos,
  resumenConciliaciones,
  saldoPorCaja,
  signo,
  totalPorMedio,
  totalPorMoneda,
} from "@/lib/cajas";
import type { Caja, Conciliacion, MovimientoCaja } from "@/lib/types";

const cajaArs = (id: string, nombre = id): Caja => ({
  id,
  nombre,
  moneda: "ars",
  activa: true,
  descripcion: "",
  creadaEl: "sep 2024",
  medioPago: "pesos",
});
const cajaUsd = (id: string, nombre = id): Caja => ({
  id,
  nombre,
  moneda: "usd",
  activa: true,
  descripcion: "",
  creadaEl: "sep 2024",
  medioPago: "dolares",
});

const mov = (
  p: Partial<MovimientoCaja> & Pick<MovimientoCaja, "cajaId" | "tipo" | "monto">,
): MovimientoCaja => ({
  id: Math.random().toString(36).slice(2),
  fecha: "07 sep",
  fechaISO: "2026-09-07",
  hora: "10:00",
  concepto: "x",
  medioPago: "pesos",
  categoria: null,
  cotizacion: null,
  ticketId: null,
  usuario: "Ana",
  conciliacionId: null,
  ...p,
});

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

describe("saldoPorCaja", () => {
  it("neta por caja en la moneda de cada caja", () => {
    const cajas = [cajaArs("a"), cajaUsd("b")];
    const movs = [
      mov({ cajaId: "a", tipo: "ingreso", monto: 1000 }),
      mov({ cajaId: "a", tipo: "egreso", monto: 200 }),
      mov({ cajaId: "b", tipo: "ingreso", monto: 50 }),
    ];
    const saldos = saldoPorCaja(movs, cajas);
    expect(saldos.find((s) => s.cajaId === "a")).toMatchObject({ saldo: 800, moneda: "ars", movimientos: 2 });
    expect(saldos.find((s) => s.cajaId === "b")).toMatchObject({ saldo: 50, moneda: "usd", movimientos: 1 });
  });

  it("ignora movimientos de cajas desconocidas", () => {
    expect(saldoPorCaja([mov({ cajaId: "z", tipo: "ingreso", monto: 1 })], [])).toEqual([]);
  });
});

describe("totalPorMoneda", () => {
  it("separa ARS y USD sin convertir", () => {
    const cajas = [cajaArs("a"), cajaUsd("b")];
    const movs = [
      mov({ cajaId: "a", tipo: "ingreso", monto: 1000 }),
      mov({ cajaId: "a", tipo: "egreso", monto: 250 }),
      mov({ cajaId: "b", tipo: "ingreso", monto: 40 }),
    ];
    expect(totalPorMoneda(movs, cajas)).toEqual({ ars: 750, usd: 40 });
  });
});

describe("totalPorMedio", () => {
  it("consolida en USD con la cotización guardada", () => {
    const cajas = [cajaArs("a"), cajaUsd("b")];
    const movs = [
      mov({ cajaId: "a", tipo: "ingreso", monto: 14650, cotizacion: 1465 }),
      mov({ cajaId: "b", tipo: "ingreso", monto: 20, medioPago: "dolares" }),
      mov({ cajaId: "b", tipo: "egreso", monto: 5, medioPago: "dolares" }),
    ];
    expect(totalPorMedio(movs, cajas, "pesos")).toBe(10);
    expect(totalPorMedio(movs, cajas, "dolares")).toBe(15);
  });

  it("no inventa cotización: un movimiento en pesos sin cotización queda afuera", () => {
    const cajas = [cajaArs("a")];
    const movs = [mov({ cajaId: "a", tipo: "ingreso", monto: 5000, cotizacion: null })];
    expect(totalPorMedio(movs, cajas, "pesos")).toBe(0);
  });
});

describe("ingresosEgresosPorDia", () => {
  it("agrupa por fechaISO y ordena ascendente", () => {
    const cajas = [cajaArs("a")];
    const movs = [
      mov({ cajaId: "a", tipo: "ingreso", monto: 1465, cotizacion: 1465, fechaISO: "2026-09-08" }),
      mov({ cajaId: "a", tipo: "ingreso", monto: 2930, cotizacion: 1465, fechaISO: "2026-09-07" }),
      mov({ cajaId: "a", tipo: "egreso", monto: 1465, cotizacion: 1465, fechaISO: "2026-09-07" }),
    ];
    const dias = ingresosEgresosPorDia(movs, cajas);
    expect(dias.map((d) => d.fecha)).toEqual(["2026-09-07", "2026-09-08"]);
    expect(dias[0]).toMatchObject({ ingresos: 2, egresos: 1 });
    expect(dias[1]).toMatchObject({ ingresos: 1, egresos: 0 });
  });
});

describe("diferenciaDeLinea", () => {
  it("contado menos sistema", () => {
    expect(diferenciaDeLinea({ cajaId: "a", montoSistema: 100, montoReal: 80, comentario: "" })).toBe(-20);
    expect(diferenciaDeLinea({ cajaId: "a", montoSistema: 100, montoReal: 120, comentario: "" })).toBe(20);
  });
});

const conc = (id: string, fecha: string, lineas: Conciliacion["lineas"]): Conciliacion => ({
  id,
  fecha,
  hora: "10:00",
  responsable: "Ana",
  lineas,
});

describe("resumenConciliaciones", () => {
  it("cuenta totales y separa la diferencia por moneda", () => {
    const cajas = [cajaArs("a"), cajaUsd("b")];
    const concs = [
      conc("c2", "08 sep", [
        { cajaId: "a", montoSistema: 1000, montoReal: 900, comentario: "" },
        { cajaId: "b", montoSistema: 10, montoReal: 12, comentario: "" },
      ]),
      conc("c1", "07 sep", [{ cajaId: "a", montoSistema: 100, montoReal: 100, comentario: "" }]),
    ];
    const r = resumenConciliaciones(concs, cajas);
    expect(r.total).toBe(2);
    expect(r.conDiferencia).toBe(1);
    expect(r.diferenciaArs).toBe(-100);
    expect(r.diferenciaUsd).toBe(2);
    expect(r.ultima).toBe("08 sep · 10:00");
  });

  it("sin conciliaciones deja todo en cero", () => {
    const r = resumenConciliaciones([], []);
    expect(r).toMatchObject({ total: 0, conDiferencia: 0, diferenciaArs: 0, diferenciaUsd: 0, ultima: null });
  });
});

describe("diferenciaPorConciliacion", () => {
  it("cuenta sobrantes y faltantes y va en orden cronológico", () => {
    const cajas = [cajaArs("a"), cajaArs("b")];
    const concs = [
      conc("c2", "08 sep", [
        { cajaId: "a", montoSistema: 100, montoReal: 90, comentario: "" },
      ]),
      conc("c1", "07 sep", [
        { cajaId: "a", montoSistema: 100, montoReal: 110, comentario: "" },
        { cajaId: "b", montoSistema: 100, montoReal: 70, comentario: "" },
      ]),
    ];
    const filas = diferenciaPorConciliacion(concs, cajas);
    expect(filas.map((f) => f.label)).toEqual(["07 sep", "08 sep"]);
    expect(filas[0]).toMatchObject({ sobrantes: 1, faltantes: 1, cajasConDiferencia: 2 });
    expect(filas[1]).toMatchObject({ sobrantes: 0, faltantes: 1, cajasConDiferencia: 1 });
  });
});

describe("diferenciaPorCaja", () => {
  it("acumula en la moneda de la caja y omite cajas sin diferencia", () => {
    const cajas = [cajaArs("a"), cajaArs("b")];
    const concs = [
      conc("c1", "07 sep", [
        { cajaId: "a", montoSistema: 100, montoReal: 110, comentario: "" },
        { cajaId: "b", montoSistema: 100, montoReal: 100, comentario: "" },
      ]),
      conc("c2", "08 sep", [{ cajaId: "a", montoSistema: 100, montoReal: 90, comentario: "" }]),
    ];
    const filas = diferenciaPorCaja(concs, cajas);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ cajaId: "a", moneda: "ars", diff: 0, conciliaciones: 2 });
  });
});
