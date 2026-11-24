import { describe, expect, it } from "vitest";
import { tablaAHtml, tablaATsv } from "./portapapeles";

describe("portapapeles", () => {
  it("tablaATsv separa con tabs y aplana saltos de línea", () => {
    expect(tablaATsv([["a", "b"], ["c\nd", "e\tf"]])).toBe("a\tb\nc d\te f");
  });
  it("tablaAHtml escapa el contenido", () => {
    expect(tablaAHtml([["<x>", 'a "b" & c']])).toBe(
      "<table><tr><td>&lt;x&gt;</td><td>a &quot;b&quot; &amp; c</td></tr></table>",
    );
  });
});
