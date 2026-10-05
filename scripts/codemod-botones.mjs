/**
 * Codemod del plan 010: migra <button> con `className` string-literal (una
 * sola clase, aunque esté en varias líneas) al primitivo <Button>. Clasifica
 * por regex sobre los tokens que ya usa cada botón a mano. Los className
 * compuestos (`cn(...)`, condicionales) se dejan para migrar a mano.
 *
 * Uso: node scripts/codemod-botones.mjs <archivo...>
 */
import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";

/** Devuelve { variant, fullOnMobile, extra } o null si no es un botón de
 * acción reconocible. */
function clasificar(cls) {
  if (!cls.includes("rounded-full")) return null;
  let variant = null;
  if (cls.includes("border border-red-200") && cls.includes("text-red-600")) variant = "danger-outline";
  else if (cls.includes("bg-red-600") && cls.includes("text-white")) variant = "danger";
  else if (cls.includes("border-accent/40") && cls.includes("text-accent")) variant = "tonal";
  else if (cls.includes("bg-accent") && cls.includes("text-white")) variant = "primary";
  else if (cls.includes("border-neutral-200") && cls.includes("text-neutral-600")) variant = "outline";
  else if (cls.includes("border-neutral-900/10") && cls.includes("text-neutral-900")) variant = "outline";
  else return null;

  const fullOnMobile = cls.includes("w-full");
  let extra = "";
  if (/sm:mr-auto/.test(cls)) extra = "sm:mr-auto";
  else if (/md:ml-auto/.test(cls)) extra = "md:ml-auto";
  else if (/sm:ml-auto/.test(cls)) extra = "sm:ml-auto";

  // Tamaño: h-7 -> sm, h-9 -> md (default), h-8 -> sm.
  let size = "md";
  if (/\bh-7\b/.test(cls) || /\bh-8\b/.test(cls)) size = "sm";

  return { variant, fullOnMobile, extra, size };
}

function classNameLit(node) {
  for (const p of node.attributes.properties) {
    if (ts.isJsxAttribute(p) && p.name.getText() === "className" && p.initializer && ts.isStringLiteral(p.initializer)) {
      return p.initializer;
    }
  }
  return null;
}

function procesar(ruta) {
  const src = readFileSync(ruta, "utf8");
  const sf = ts.createSourceFile(ruta, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  let tocados = 0;

  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText() === "button") {
      const lit = classNameLit(node);
      const tipo = lit ? clasificar(lit.text) : null;
      if (tipo) {
        const attrs = [`variant="${tipo.variant}"`];
        if (tipo.size !== "md") attrs.push(`size="${tipo.size}"`);
        if (tipo.fullOnMobile) attrs.push("fullOnMobile");
        if (tipo.extra) attrs.push(`className="${tipo.extra}"`);
        edits.push({ start: lit.parent.getStart(sf), end: lit.parent.getEnd(), text: attrs.join(" ") });
        edits.push({ start: node.tagName.getStart(sf), end: node.tagName.getEnd(), text: "Button" });
        if (ts.isJsxElement(node.parent)) {
          const ct = node.parent.closingElement;
          edits.push({ start: ct.tagName.getStart(sf), end: ct.tagName.getEnd(), text: "Button" });
        }
        tocados++;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  if (tocados === 0) return 0;
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);

  if (!/from "@\/components\/ui\/button"/.test(out)) {
    const m = out.match(/^import .*from ["'][^"']+["'];$/m);
    const imp = `import { Button } from "@/components/ui/button";\n`;
    if (m) out = out.slice(0, m.index) + imp + out.slice(m.index);
    else out = imp + out;
  }
  writeFileSync(ruta, out);
  return tocados;
}

let total = 0;
for (const ruta of process.argv.slice(2)) total += procesar(ruta);
console.log(`Botones migrados: ${total}`);
