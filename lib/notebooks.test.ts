import { describe, expect, it } from "vitest";
import { notebookSchema } from "@/lib/notebooks";

const base = {
  modelo: "MacBook Air",
  numeroSerie: "C02XYZ",
  costoUsd: 500,
  precioUsd: 700,
  estado: "disponible" as const,
};

describe("notebookSchema · condición y batería", () => {
  it("una nueva no necesita batería", () => {
    expect(notebookSchema.safeParse({ ...base, condicion: "nuevo", bateria: null }).success).toBe(true);
  });

  it("una usada exige batería", () => {
    const r = notebookSchema.safeParse({ ...base, condicion: "usado", bateria: null });
    expect(r.success).toBe(false);
  });

  it("una usada con batería entre 0 y 100 es válida", () => {
    expect(notebookSchema.safeParse({ ...base, condicion: "usado", bateria: 87 }).success).toBe(true);
    expect(notebookSchema.safeParse({ ...base, condicion: "usado", bateria: 0 }).success).toBe(true);
    expect(notebookSchema.safeParse({ ...base, condicion: "usado", bateria: 101 }).success).toBe(false);
    expect(notebookSchema.safeParse({ ...base, condicion: "usado", bateria: -1 }).success).toBe(false);
  });
});

describe("notebookSchema · número de serie y ciclos", () => {
  it("el número de serie es obligatorio", () => {
    expect(notebookSchema.safeParse({ ...base, numeroSerie: "  ", condicion: "nuevo" }).success).toBe(false);
    const { numeroSerie: _omitida, ...sinSerie } = base;
    expect(notebookSchema.safeParse({ ...sinSerie, condicion: "nuevo" }).success).toBe(false);
  });

  it("los ciclos son un entero >= 0 u omitidos", () => {
    const usada = { ...base, condicion: "usado" as const, bateria: 90 };
    expect(notebookSchema.parse(usada).ciclosBateria).toBeNull();
    expect(notebookSchema.safeParse({ ...usada, ciclosBateria: 120 }).success).toBe(true);
    expect(notebookSchema.safeParse({ ...usada, ciclosBateria: -3 }).success).toBe(false);
  });
});
