import { describe, expect, it } from "vitest";
import {
  etiquetaRoles,
  mismosRoles,
  normalizarRoles,
  rolPrincipal,
  tieneRol,
} from "./roles";

describe("tieneRol", () => {
  it("es la unión: Vendedor + Técnico cumple los roles de ambos", () => {
    const user = { roles: ["vendedor", "tecnico"] as const };
    expect(tieneRol(user, "vendedor")).toBe(true);
    expect(tieneRol(user, "tecnico")).toBe(true);
    expect(tieneRol(user, "admin")).toBe(false);
    expect(tieneRol(user, "admin", "tecnico")).toBe(true);
  });

  it("admin incluye todo", () => {
    const user = { roles: ["admin"] as const };
    for (const rol of ["admin", "vendedor", "tecnico"] as const) {
      expect(tieneRol(user, rol)).toBe(true);
    }
  });

  it("sin roles pedidos, true", () => {
    expect(tieneRol({ roles: ["vendedor"] })).toBe(true);
  });

  it("un vendedor solo no ve lo de admin/técnico", () => {
    const user = { roles: ["vendedor"] as const };
    expect(tieneRol(user, "admin")).toBe(false);
    expect(tieneRol(user, "tecnico")).toBe(false);
    expect(tieneRol(user, "admin", "tecnico")).toBe(false);
  });
});

describe("normalizarRoles", () => {
  it("deduplica y ordena admin, vendedor, tecnico", () => {
    expect(normalizarRoles(["tecnico", "vendedor", "tecnico"])).toEqual([
      "vendedor",
      "tecnico",
    ]);
  });
  it("admin absorbe al resto", () => {
    expect(normalizarRoles(["vendedor", "admin", "tecnico"])).toEqual(["admin"]);
  });
  it("descarta valores inválidos", () => {
    expect(normalizarRoles(["vendedor", "superadmin"])).toEqual(["vendedor"]);
    expect(normalizarRoles(["superadmin"])).toEqual([]);
  });
  it("null/undefined → vacío", () => {
    expect(normalizarRoles(null)).toEqual([]);
    expect(normalizarRoles(undefined)).toEqual([]);
  });
});

describe("rolPrincipal", () => {
  it("admin gana; después técnico; y vendedor por default", () => {
    expect(rolPrincipal(["admin", "tecnico"])).toBe("admin");
    expect(rolPrincipal(["vendedor", "tecnico"])).toBe("tecnico");
    expect(rolPrincipal(["vendedor"])).toBe("vendedor");
    expect(rolPrincipal([])).toBe("vendedor");
  });
});

describe("etiquetaRoles", () => {
  it("un rol → su etiqueta", () => {
    expect(etiquetaRoles(["admin"])).toBe("Admin");
    expect(etiquetaRoles(["vendedor"])).toBe("Vendedor");
  });
  it("dos roles → A y b", () => {
    expect(etiquetaRoles(["tecnico", "vendedor"])).toBe("Vendedor y técnico");
  });
  it("admin absorbe", () => {
    expect(etiquetaRoles(["admin", "vendedor"])).toBe("Admin");
  });
  it("sin roles → Sin rol", () => {
    expect(etiquetaRoles([])).toBe("Sin rol");
  });
});

describe("mismosRoles", () => {
  it("compara normalizado (orden y admin)", () => {
    expect(mismosRoles(["tecnico", "vendedor"], ["vendedor", "tecnico"])).toBe(true);
    expect(mismosRoles(["admin", "vendedor"], ["admin"])).toBe(true);
    expect(mismosRoles(["vendedor"], ["tecnico"])).toBe(false);
  });
});
