import { describe, expect, it } from "vitest";
import { IA_LECTURAS_POR_ENTIDAD, IA_MAX_CARACTERES, lecturasRestantes, validarTextoIa } from "./ia-lecturas";

describe("lecturasRestantes", () => {
  it("una lectura por tipo, nunca negativo", () => {
    expect(lecturasRestantes(0)).toBe(IA_LECTURAS_POR_ENTIDAD);
    expect(lecturasRestantes(1)).toBe(0);
    expect(lecturasRestantes(5)).toBe(0);
  });
});

describe("validarTextoIa", () => {
  it("rechaza vacío y textos más largos que el máximo", () => {
    expect(validarTextoIa("   ")).not.toBeNull();
    expect(validarTextoIa("x".repeat(IA_MAX_CARACTERES + 1))).not.toBeNull();
    expect(validarTextoIa("iPhone 13 128GB azul")).toBeNull();
  });
});
