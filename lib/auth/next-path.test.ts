import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("acepta rutas internas", () => {
    expect(safeNextPath("/dashboard", "/x")).toBe("/dashboard");
    expect(safeNextPath("/ventas?open=12", "/x")).toBe("/ventas?open=12");
  });

  it("rechaza URLs externas y protocol-relative", () => {
    expect(safeNextPath("https://evil.com", "/x")).toBe("/x");
    expect(safeNextPath("//evil.com", "/x")).toBe("/x");
  });

  it("rechaza barra invertida y caracteres de control", () => {
    expect(safeNextPath("/\\evil.com", "/x")).toBe("/x");
    expect(safeNextPath("/\t/evil.com", "/x")).toBe("/x");
    expect(safeNextPath("/\n/evil.com", "/x")).toBe("/x");
  });

  it("vacío o null cae al fallback", () => {
    expect(safeNextPath(null, "/x")).toBe("/x");
    expect(safeNextPath("", "/x")).toBe("/x");
  });
});
