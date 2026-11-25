import { describe, expect, it } from "vitest";
import { navForRole, navCategoriesForRole, NAV } from "@/lib/nav";

const SOLO_ADMIN_TECNICO = ["/compras", "/cuentas-corrientes", "/cajas"];
const ADMIN = ["admin"] as const;
const VENDEDOR = ["vendedor"] as const;
const TECNICO = ["tecnico"] as const;
const VENDEDOR_TECNICO = ["vendedor", "tecnico"] as const;
const TODOS = ["admin", "vendedor", "tecnico"] as const;

describe("navForRole", () => {
  it("admin ve todo, incluida Configuración", () => {
    const items = navForRole(ADMIN);
    expect(items).toHaveLength(NAV.length);
    expect(items.some((i) => i.href === "/configuracion")).toBe(true);
  });

  it("vendedor y técnico no ven Configuración", () => {
    expect(navForRole(VENDEDOR).some((i) => i.href === "/configuracion")).toBe(false);
    expect(navForRole(TECNICO).some((i) => i.href === "/configuracion")).toBe(false);
  });

  it("un ítem sin `roles` es visible para cualquier rol", () => {
    for (const roles of [ADMIN, VENDEDOR, TECNICO, VENDEDOR_TECNICO]) {
      expect(navForRole(roles).some((i) => i.href === "/dashboard")).toBe(true);
    }
  });

  it("Analíticas (márgenes, costos, ganancia) es solo admin", () => {
    expect(navForRole(ADMIN).some((i) => i.href === "/analiticas")).toBe(true);
    expect(navForRole(TECNICO).some((i) => i.href === "/analiticas")).toBe(false);
    expect(navForRole(VENDEDOR).some((i) => i.href === "/analiticas")).toBe(false);
  });

  it("vendedor no ve Compras, Cuentas corrientes ni Cajas", () => {
    const hrefs = navForRole(VENDEDOR).map((i) => i.href);
    for (const href of SOLO_ADMIN_TECNICO) {
      expect(hrefs).not.toContain(href);
    }
  });

  it("admin y técnico sí ven esas 3 secciones", () => {
    for (const roles of [ADMIN, TECNICO]) {
      const hrefs = navForRole(roles).map((i) => i.href);
      for (const href of SOLO_ADMIN_TECNICO) {
        expect(hrefs).toContain(href);
      }
    }
  });

  it("Vendedor + Técnico ve la unión (incluye las 3 de técnico, sin admin)", () => {
    const hrefs = navForRole(VENDEDOR_TECNICO).map((i) => i.href);
    for (const href of SOLO_ADMIN_TECNICO) {
      expect(hrefs).toContain(href);
    }
    expect(hrefs).not.toContain("/configuracion");
    expect(hrefs).not.toContain("/analiticas");
  });

  it("con los 3 roles queda igual que admin (admin no suma ítems extra)", () => {
    expect(navForRole(TODOS)).toEqual(navForRole(ADMIN));
  });
});

describe("navCategoriesForRole", () => {
  it("a un vendedor \"Stock\" le queda con Inventario y Recuentos, sin Compras", () => {
    const stock = navCategoriesForRole(VENDEDOR).find((c) => c.key === "/inventario");
    const hrefs = stock?.children.map((c) => c.href);
    expect(hrefs).toEqual(["/inventario", "/recuentos"]);
  });

  it("a un admin \"Stock\" es un dropdown de 3 (incluye Compras)", () => {
    const stock = navCategoriesForRole(ADMIN).find((c) => c.key === "/inventario");
    expect(stock?.children).toHaveLength(3);
  });

  it("a un técnico \"Finanzas\" le queda con Cajas y Cuentas corrientes, sin Analíticas", () => {
    const finanzas = navCategoriesForRole(TECNICO).find((c) => c.key === "/cajas");
    expect(finanzas?.children.map((c) => c.href)).toEqual(["/cajas", "/cuentas-corrientes"]);
  });

  it("a un vendedor no le queda categoría \"Finanzas\" (Cajas/Analíticas/Cuentas corrientes ocultas)", () => {
    const finanzas = navCategoriesForRole(VENDEDOR).find((c) => c.key === "/cajas");
    expect(finanzas).toBeUndefined();
  });

  it("Vendedor + Técnico sí tiene Finanzas (unión)", () => {
    const finanzas = navCategoriesForRole(VENDEDOR_TECNICO).find((c) => c.key === "/cajas");
    expect(finanzas?.children.map((c) => c.href)).toEqual(["/cajas", "/cuentas-corrientes"]);
  });

  it("a un admin \"Finanzas\" es un dropdown de 5 (Cajas, Analíticas, Patrimonio, Resúmenes, Cuentas corrientes)", () => {
    const finanzas = navCategoriesForRole(ADMIN).find((c) => c.key === "/cajas");
    expect(finanzas?.children).toHaveLength(5);
  });
});
