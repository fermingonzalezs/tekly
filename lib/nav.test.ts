import { describe, expect, it } from "vitest";
import { navForRole, NAV } from "@/lib/nav";

describe("navForRole", () => {
  it("admin ve todo, incluida Configuración", () => {
    const items = navForRole("admin");
    expect(items).toHaveLength(NAV.length);
    expect(items.some((i) => i.href === "/configuracion")).toBe(true);
  });

  it("vendedor y técnico no ven Configuración", () => {
    expect(navForRole("vendedor").some((i) => i.href === "/configuracion")).toBe(false);
    expect(navForRole("tecnico").some((i) => i.href === "/configuracion")).toBe(false);
  });

  it("un ítem sin `roles` es visible para cualquier rol", () => {
    for (const rol of ["admin", "vendedor", "tecnico"] as const) {
      expect(navForRole(rol).some((i) => i.href === "/dashboard")).toBe(true);
    }
  });
});
