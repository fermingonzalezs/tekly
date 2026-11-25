import { describe, expect, it } from "vitest";
import { rentabilidadTicket } from "./reparaciones";
import type { TicketServicio } from "./types";

const actual = (id: string) => ({ pantalla: 50, bateria: 20 } as Record<string, number>)[id];

describe("rentabilidadTicket", () => {
  it("resta el costo de los repuestos al precio total", () => {
    const servicios: TicketServicio[] = [
      { origen: "servicio", nombre: "Cambio de pantalla", precioUsd: 60 },
      { origen: "repuesto", repuestoId: "pantalla", nombre: "Pantalla", precioUsd: 80, cantidad: 1, costoUsd: 45 },
    ];
    const r = rentabilidadTicket(servicios, actual);
    expect(r.precioUsd).toBe(140);
    expect(r.costoUsd).toBe(45);
    expect(r.gananciaUsd).toBe(95);
    expect(r.margenPct).toBeCloseTo((95 / 140) * 100);
  });
  it("usa el costo congelado aunque el repuesto haya cambiado", () => {
    const r = rentabilidadTicket(
      [{ origen: "repuesto", repuestoId: "pantalla", nombre: "P", precioUsd: 80, costoUsd: 30 }],
      actual,
    );
    expect(r.costoUsd).toBe(30);
  });
  it("sin snapshot (ticket viejo) usa el costo actual, por cantidad", () => {
    const r = rentabilidadTicket(
      [{ origen: "repuesto", repuestoId: "bateria", nombre: "B", precioUsd: 30, cantidad: 2 }],
      actual,
    );
    expect(r.costoUsd).toBe(40);
  });
  it("cuenta los repuestos de costo desconocido", () => {
    const r = rentabilidadTicket(
      [{ origen: "repuesto", repuestoId: "x", nombre: "X", precioUsd: 10 }],
      actual,
    );
    expect(r.costoUsd).toBe(0);
    expect(r.sinCosto).toBe(1);
  });
  it("sin ítems no hay margen", () => {
    expect(rentabilidadTicket([]).margenPct).toBeNull();
  });
});
