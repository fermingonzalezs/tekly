import { describe, expect, it } from "vitest";
import { instagramUrl, normalizarInstagram } from "./instagram";

describe("normalizarInstagram", () => {
  it("vacío es sin Instagram", () => {
    expect(normalizarInstagram("")).toEqual({ ok: true, usuario: null });
    expect(normalizarInstagram("   ")).toEqual({ ok: true, usuario: null });
    expect(normalizarInstagram(null)).toEqual({ ok: true, usuario: null });
  });

  it("saca la @ y pasa a minúscula", () => {
    expect(normalizarInstagram(" @Hell.Store_ ")).toEqual({ ok: true, usuario: "hell.store_" });
  });

  it("acepta el link al perfil con o sin parámetros", () => {
    for (const link of [
      "https://www.instagram.com/hellstore/?igsh=abc123",
      "instagram.com/hellstore",
      "http://m.instagram.com/HellStore/",
      "instagr.am/hellstore",
    ]) {
      expect(normalizarInstagram(link)).toEqual({ ok: true, usuario: "hellstore" });
    }
  });

  it("rechaza links de otros sitios y formatos inválidos", () => {
    expect(normalizarInstagram("https://facebook.com/hellstore").ok).toBe(false);
    expect(normalizarInstagram(".hellstore").ok).toBe(false);
    expect(normalizarInstagram("hellstore.").ok).toBe(false);
    expect(normalizarInstagram("hell..store").ok).toBe(false);
    expect(normalizarInstagram("hell store").ok).toBe(false);
    expect(normalizarInstagram("hellstore!").ok).toBe(false);
    expect(normalizarInstagram("a".repeat(31)).ok).toBe(false);
    expect(normalizarInstagram("a".repeat(30))).toEqual({ ok: true, usuario: "a".repeat(30) });
  });

  it("arma el link al perfil", () => {
    expect(instagramUrl("hellstore")).toBe("https://www.instagram.com/hellstore/");
  });
});
