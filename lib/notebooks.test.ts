import { describe, expect, it } from "vitest";
import { notebookSchema } from "@/lib/notebooks";

const base = {
  modelo: "MacBook Air",
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
