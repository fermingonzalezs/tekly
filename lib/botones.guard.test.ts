import { describe, expect, it } from "vitest";
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/** Guarda anti-regresión del plan 010: no se pueden escribir a mano botones
 * con las firmas que ya cubre el primitivo (`components/ui/button.tsx`). Si
 * aparece uno, usá `<Button>` / `<IconButton>`.
 *
 * Lista blanca: los propios primitivos, la landing (su `<a>` es de marketing)
 * y las excepciones documentadas (FAB de reportar bug, tarjetas/filas
 * seleccionables que usan <button> como contenedor). */

const RAIZ = path.resolve(__dirname, "..");
const DIRS = ["app", "components"];
const WHITELIST = [
  "components/ui/button.tsx",
  "components/ui/tabs.tsx",
  "components/ui/pagination.tsx",
  "components/ui/cliente-picker.tsx",
  "components/ui/seccion-tabla.tsx",
  "components/ui/barra-filtros.tsx",
  "components/marketing/",
  "components/reportar-bug-fab.tsx",
  "app/qa/",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function archivos(): string[] {
  return DIRS.flatMap((d) => walk(path.join(RAIZ, d))).filter((f) => {
    const rel = path.relative(RAIZ, f);
    return !WHITELIST.some((w) => rel.startsWith(w));
  });
}

/** Clases que delatan un botón de acción hecho a mano (no una tarjeta/fila). */
function esBotonDeAccion(className: string): boolean {
  if (!className.includes("rounded-full")) return false;
  if (className.includes("bg-accent") && className.includes("text-white")) return true;
  if (className.includes("border-accent/40")) return true;
  if (className.includes("border border-neutral-200") && className.includes("px-")) return true;
  if (className.includes("border-red-200") && className.includes("text-red-600")) return true;
  return false;
}

function claseEstatica(node: ts.JsxOpeningLikeElement): string | null {
  for (const p of node.attributes.properties) {
    if (
      ts.isJsxAttribute(p) &&
      p.name.getText() === "className" &&
      p.initializer &&
      ts.isStringLiteral(p.initializer)
    ) {
      return p.initializer.text;
    }
  }
  return null;
}

describe("guarda de botones (plan 010)", () => {
  it("no hay <button> con firmas de botón a mano fuera de la white list", () => {
    const violaciones: string[] = [];
    for (const archivo of archivos()) {
      const src = readFileSync(archivo, "utf8");
      const sf = ts.createSourceFile(archivo, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          if (node.tagName.getText() === "button") {
            const cls = claseEstatica(node);
            if (cls && esBotonDeAccion(cls)) {
              const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
              violaciones.push(
                `${path.relative(RAIZ, archivo)}:${line + 1} — usá <Button> / <IconButton>`,
              );
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    expect(violaciones).toEqual([]);
  });
});
