import { describe, expect, it } from "vitest";
import { navForRole, navCategoriesForRole, NAV } from "@/lib/nav";

const SOLO_ADMIN_TECNICO = ["/compras", "/cuentas-corrientes", "/cajas", "/analiticas"];

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

  it("vendedor no ve Compras, Cuentas corrientes, Cajas ni Analíticas", () => {
    const hrefs = navForRole("vendedor").map((i) => i.href);
    for (const href of SOLO_ADMIN_TECNICO) {
      expect(hrefs).not.toContain(href);
    }
  });

  it("admin y técnico sí ven esas 4 secciones", () => {
    for (const rol of ["admin", "tecnico"] as const) {
      const hrefs = navForRole(rol).map((i) => i.href);
      for (const href of SOLO_ADMIN_TECNICO) {
        expect(hrefs).toContain(href);
      }
    }
  });
});

describe("navCategoriesForRole", () => {
  it("a un vendedor \"Stock\" le queda con Inventario y Recuentos, sin Compras", () => {
    const stock = navCategoriesForRole("vendedor").find((c) => c.key === "/inventario");
    const hrefs = stock?.children.map((c) => c.href);
    expect(hrefs).toEqual(["/inventario", "/recuentos"]);
  });

  it("a un admin \"Stock\" es un dropdown de 3 (incluye Compras)", () => {
    const stock = navCategoriesForRole("admin").find((c) => c.key === "/inventario");
    expect(stock?.children).toHaveLength(3);
  });

  it("a un vendedor no le queda categoría \"Finanzas\" (Cajas/Analíticas/Cuentas corrientes ocultas)", () => {
    const finanzas = navCategoriesForRole("vendedor").find((c) => c.key === "/cajas");
    expect(finanzas).toBeUndefined();
  });

  it("a un admin \"Finanzas\" sigue siendo un dropdown de 3", () => {
    const finanzas = navCategoriesForRole("admin").find((c) => c.key === "/cajas");
    expect(finanzas?.children).toHaveLength(3);
  });
});
