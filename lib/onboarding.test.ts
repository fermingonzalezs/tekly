import { describe, expect, it } from "vitest";
import { combinarPasosOnboarding, hrefDesdeOnboarding, pasoOnboardingDesdeParam } from "./onboarding";

describe("hrefDesdeOnboarding", () => {
  it("agrega el paso como param, respetando un query existente", () => {
    expect(hrefDesdeOnboarding({ id: "negocio", href: "/configuracion?tab=negocio" })).toBe(
      "/configuracion?tab=negocio&onboarding=negocio",
    );
    expect(hrefDesdeOnboarding({ id: "cajas", href: "/cajas" })).toBe("/cajas?onboarding=cajas");
  });
});

describe("pasoOnboardingDesdeParam", () => {
  it("devuelve el paso si es válido y null si no", () => {
    expect(pasoOnboardingDesdeParam("servicios")).toBe("servicios");
    expect(pasoOnboardingDesdeParam("otra-cosa")).toBeNull();
    expect(pasoOnboardingDesdeParam(null)).toBeNull();
  });
});

describe("combinarPasosOnboarding", () => {
  it("un paso está hecho si lo tildaron a mano o si los datos lo indican", () => {
    expect(
      combinarPasosOnboarding({ negocio: true }, { cajas: true, servicios: false }),
    ).toEqual({ negocio: true, importar: false, cajas: true, usuarios: false, servicios: false });
  });
});
