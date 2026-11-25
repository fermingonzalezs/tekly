import { describe, expect, it } from "vitest";
import { BATERIA_CELULAR_NUEVO, bateriaCelular, esCelularNuevo } from "./status";

describe("batería de celulares nuevos", () => {
  it("reconoce NUEVO sin importar mayúsculas ni espacios", () => {
    expect(esCelularNuevo("NUEVO")).toBe(true);
    expect(esCelularNuevo(" nuevo ")).toBe(true);
    expect(esCelularNuevo("A+")).toBe(false);
    expect(esCelularNuevo(null)).toBe(false);
  });

  it("un nuevo guarda 100 aunque se haya cargado otro valor; un usado guarda el suyo", () => {
    expect(bateriaCelular("NUEVO", 37)).toBe(BATERIA_CELULAR_NUEVO);
    expect(bateriaCelular("B", 87)).toBe(87);
  });
});
