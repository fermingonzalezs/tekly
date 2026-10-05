import { describe, expect, it } from "vitest";
import ts from "typescript";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

/** Guard de aislamiento de la demo (plan 014): nada bajo `app/demo/`,
 * `lib/demo/` ni `components/demo/` puede importar (en runtime) `@/lib/db/*`,
 * `@/lib/auth`, `@supabase/*` ni `server-only`. Los `import type` sí se
 * permiten (se borran en compilación, no arrastran el módulo): el seed usa
 * `import type { Negocio }` para tipar su negocio de ejemplo. */

const RAIZ = path.resolve(__dirname, "..");
const DIRS = ["app/demo", "lib/demo", "components/demo"];
const PROHIBIDOS = ["@/lib/db/", "@/lib/auth", "@supabase/", "server-only"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function archivos(): string[] {
  return DIRS.flatMap((d) => {
    const full = path.join(RAIZ, d);
    return existsSync(full) ? walk(full) : [];
  });
}

describe("aislamiento de la demo (plan 014)", () => {
  it("no importa módulos server-only (los import type no cuentan)", () => {
    const violaciones: string[] = [];
    for (const archivo of archivos()) {
      const src = readFileSync(archivo, "utf8");
      const sf = ts.createSourceFile(
        archivo,
        src,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node)) {
          const typeOnly = node.importClause?.isTypeOnly ?? false;
          const spec = node.moduleSpecifier;
          if (!typeOnly && ts.isStringLiteral(spec)) {
            const mod = spec.text;
            if (PROHIBIDOS.some((p) => mod.includes(p))) {
              const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
              violaciones.push(
                `${path.relative(RAIZ, archivo)}:${line + 1} — importa "${mod}"`,
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
