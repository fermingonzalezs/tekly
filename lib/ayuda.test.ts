import { describe, expect, it } from "vitest";
import {
  SECCIONES_AYUDA,
  articuloDeSeccion,
  buscar,
  getArticulo,
  indicePorSeccion,
  indicePlano,
  listArticulos,
  relacionados,
  vecinos,
} from "@/lib/ayuda";

describe("centro de ayuda (contenido real)", () => {
  it("carga y valida todos los artículos (frontmatter correcto)", () => {
    const arts = listArticulos();
    expect(arts.length).toBeGreaterThan(10);
    for (const a of arts) {
      expect(a.titulo.length).toBeGreaterThan(0);
      expect(a.resumen.length).toBeGreaterThan(0);
      expect(a.actualizado).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(SECCIONES_AYUDA).toContain(a.seccion);
    }
  });

  it("no hay slugs duplicados", () => {
    const ids = listArticulos().map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("el índice por sección solo incluye secciones con artículos", () => {
    const idx = indicePorSeccion();
    expect(idx.length).toBeGreaterThan(0);
    for (const g of idx) expect(g.articulos.length).toBeGreaterThan(0);
  });

  it("el índice por rol filtra los artículos solo-admin", () => {
    const admin = indicePorSeccion("admin").flatMap((g) => g.articulos.map((a) => a.id));
    const vendedor = indicePorSeccion("vendedor").flatMap((g) => g.articulos.map((a) => a.id));
    expect(admin).toContain("analiticas/guia");
    expect(vendedor).not.toContain("analiticas/guia");
  });

  it("getArticulo devuelve el artículo o null", () => {
    expect(getArticulo("ventas", "guia")?.titulo).toBe("Módulo Ventas");
    expect(getArticulo("ventas", "no-existe")).toBeNull();
  });

  it("articuloDeSeccion respeta el rol", () => {
    expect(articuloDeSeccion("ventas")?.seccion).toBe("ventas");
    // analiticas es solo admin
    expect(articuloDeSeccion("analiticas", "admin")?.seccion).toBe("analiticas");
    expect(articuloDeSeccion("analiticas", "vendedor")).toBeNull();
  });

  it("vecinos arma anterior/siguiente dentro de la sección", () => {
    const guia = getArticulo("ventas", "guia")!;
    expect(vecinos(guia).anterior).toBeNull();
    expect(vecinos(guia).siguiente?.slug).toBe("pago-dividido");
  });

  it("relacionados prioriza la misma sección", () => {
    const canje = getArticulo("ventas", "canje")!;
    const rel = relacionados(canje);
    expect(rel.length).toBeGreaterThan(0);
    expect(rel[0].id).not.toBe(canje.id);
  });

  it("buscar encuentra por título, resumen y cuerpo", () => {
    expect(buscar("canje").some((a) => a.id === "ventas/canje")).toBe(true);
    expect(buscar("conciliar").some((a) => a.id === "cajas/guia")).toBe(true);
    expect(buscar("").length).toBe(0);
  });

  it("buscar respeta el rol", () => {
    expect(buscar("analíticas", "vendedor").some((a) => a.seccion === "analiticas")).toBe(false);
    expect(buscar("analíticas", "admin").some((a) => a.seccion === "analiticas")).toBe(true);
  });

  it("indicePlano no expone el cuerpo", () => {
    for (const a of indicePlano()) {
      expect(a).not.toHaveProperty("cuerpo");
      expect(a).not.toHaveProperty("archivo");
    }
  });
});
