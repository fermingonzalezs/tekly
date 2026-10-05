import { describe, expect, it } from "vitest";
import { TERMINOS_VERSION, requiereAceptarTerminos } from "./legal";

describe("requiereAceptarTerminos", () => {
  it("nunca obliga mientras los textos son borrador", () => {
    expect(requiereAceptarTerminos(null, true)).toBe(false);
    expect(requiereAceptarTerminos("vieja", true)).toBe(false);
  });
  it("obliga si no aceptó o aceptó una versión anterior", () => {
    expect(requiereAceptarTerminos(null, false)).toBe(true);
    expect(requiereAceptarTerminos("2020-01-01", false)).toBe(true);
  });
  it("no obliga si ya aceptó la versión vigente", () => {
    expect(requiereAceptarTerminos(TERMINOS_VERSION, false)).toBe(false);
  });
});
