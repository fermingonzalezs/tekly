import { describe, expect, it } from "vitest";
import {
  crearSeedDemo,
  fechaISOLocal,
  type DemoState,
} from "@/lib/demo/seed";
import { categoriaDe } from "@/lib/ventas";
import { sumarDias } from "@/lib/date-presets";

const HOY = new Date(2026, 9, 4, 15, 30, 0); // 4 oct 2026, hora local
const HOY_ISO = fechaISOLocal(HOY);

function ids(list: { id: string | number }[]): (string | number)[] {
  return list.map((x) => x.id);
}

describe("crearSeedDemo", () => {
  const state = crearSeedDemo(HOY);

  it("es determinista (mismo `hoy` -> mismo seed)", () => {
    expect(crearSeedDemo(HOY)).toEqual(state);
  });

  it("genera el volumen pedido", () => {
    expect(state.clientes).toHaveLength(12);
    expect(state.celulares).toHaveLength(15);
    expect(state.notebooks).toHaveLength(4);
    expect(state.repuestos).toHaveLength(8);
    expect(state.otros.length).toBeGreaterThanOrEqual(2);
    expect(state.servicios).toHaveLength(5);
    expect(state.cajas).toHaveLength(3);
    expect(state.ventas).toHaveLength(40);
    expect(state.turnos).toHaveLength(8);
    expect(state.tickets).toHaveLength(6);
  });

  it("usa ids únicos por colección y globalmente no choca", () => {
    for (const lista of [
      state.clientes,
      state.celulares,
      state.notebooks,
      state.repuestos,
      state.otros,
      state.servicios,
      state.cajas,
      state.turnos,
      state.tickets,
      state.ventas,
    ]) {
      const todos = ids(lista);
      expect(new Set(todos).size).toBe(todos.length);
    }
    // IMEIs de celulares únicos, de 15 dígitos.
    const imeis = state.celulares.map((e) => e.imei);
    expect(new Set(imeis).size).toBe(imeis.length);
    for (const imei of imeis) expect(imei).toMatch(/^\d{15}$/);
  });

  it("todo `Venta.items[].celularId`/`notebookId` existe en el inventario", () => {
    const celulares = new Set(state.celulares.map((e) => e.id));
    const notebooks = new Set(state.notebooks.map((n) => n.id));
    for (const venta of state.ventas) {
      for (const item of venta.items) {
        if (item.celularId) expect(celulares.has(item.celularId)).toBe(true);
        if (item.notebookId) expect(notebooks.has(item.notebookId)).toBe(true);
      }
    }
  });

  it("total = suma de ítems = suma de pagos (y márgenes definidos)", () => {
    for (const venta of state.ventas) {
      const items = venta.items.reduce((a, i) => a + i.precioUsd * i.cantidad, 0);
      const pagos = venta.pagos.reduce((a, p) => a + p.montoUsd, 0);
      expect(venta.totalUsd).toBeCloseTo(items, 2);
      expect(venta.totalUsd).toBeCloseTo(pagos, 2);
      expect(typeof venta.margenPct).toBe("number");
      expect(Number.isFinite(venta.margenPct)).toBe(true);
    }
  });

  it("fechas de ventas dentro de los últimos 70 días", () => {
    const desde = sumarDias(HOY_ISO, -70);
    for (const venta of state.ventas) {
      expect(venta.fechaISO >= desde).toBe(true);
      expect(venta.fechaISO <= HOY_ISO).toBe(true);
    }
  });

  it("los pagos a caja ARS llevan snapshot de cotización", () => {
    for (const venta of state.ventas) {
      for (const pago of venta.pagos) {
        if (pago.caja === "ars" && pago.cajaId) {
          expect(pago.cotizacion).toBeGreaterThan(0);
          expect(pago.montoArs).toBeGreaterThan(0);
        }
      }
    }
  });

  it("`categoriaDe` no revienta con ningún ítem", () => {
    for (const venta of state.ventas) {
      for (const item of venta.items) {
        expect(["celular", "notebook", "servicio", "otro", "libre"]).toContain(
          categoriaDe(item),
        );
      }
    }
  });

  it("turnos en los próximos 7 días y tickets con estados variados", () => {
    for (const turno of state.turnos) {
      expect(turno.dayOffset).toBeGreaterThanOrEqual(0);
      expect(turno.dayOffset).toBeLessThanOrEqual(6);
      expect(turno.hora).toMatch(/^\d{2}:00$/);
    }
    const estados = new Set(state.tickets.map((t) => t.estado));
    expect(estados.size).toBeGreaterThanOrEqual(4);
  });

  it("contadorVentas sigue la serie V-<n>", () => {
    expect(state.contadorVentas).toBe(1000 + state.ventas.length);
    const numeros = state.ventas.map((v) => Number(v.id.replace(/^V-/, "")));
    expect(Math.max(...numeros)).toBe(state.contadorVentas);
  });

  it("negocio demo consistente", () => {
    expect(state.negocio.nombre).toBe("Tekly Demo");
    expect(state.negocio.objetivoMesUsd).toBeGreaterThan(0);
    expect(state.negocio.colorTema).toBe("indigo");
    expect(Object.values(state.negocio.onboardingPasos).every(Boolean)).toBe(true);
  });

  it("respeta distintos `hoy` (no usa Date.now)", () => {
    const otro = new Date(2025, 0, 15, 9, 0, 0);
    const s = crearSeedDemo(otro);
    const isoOtro = fechaISOLocal(otro);
    for (const venta of s.ventas) {
      expect(venta.fechaISO <= isoOtro).toBe(true);
      expect(venta.fechaISO >= sumarDias(isoOtro, -70)).toBe(true);
    }
  });
});
