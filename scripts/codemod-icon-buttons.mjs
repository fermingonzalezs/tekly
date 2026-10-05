/**
 * Codemod icon-buttons del plan 010: <button> con un único ícono y las
 * clases "grid h-N w-N place-items-center" -> <IconButton>. Usa el `title`
 * existente como `aria-label` si no hay uno. Variante por color de hover:
 *   - hover:bg-red-50 / hover:text-red-500|600 -> danger-ghost
 *   - hover:bg-neutral-100 -> ghost
 *   - hover:bg-accent-soft -> ghost (color accent va en className)
 * Edita en reversa.
 *
 * Uso: node scripts/codemod-icon-buttons.mjs <archivo...>
 */
import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";

function clasificar(cls) {
  if (!/(grid|inline-grid|inline-flex) h-\d+ w-\d+/.test(cls)) return null;
  if (!cls.includes("place-items-center")) return null;
  if (cls.includes("rounded-full bg-red-50")) return null; // error icon, no botón
  let variant = "ghost";
  if (/hover:bg-red-50|hover:text-red-500|hover:text-red-600/.test(cls)) variant = "danger-ghost";
  let size = "md";
  if (/\bh-6\b|\bh-7\b/.test(cls)) size = "sm";
  else if (/\bh-9\b/.test(cls)) size = "lg";
  return { variant, size };
}

function attr(node, name) {
  for (const p of node.attributes.properties) {
    if (ts.isJsxAttribute(p) && p.name.getText() === name) return p;
  }
  return null;
}

function stringLit(attrNode) {
  return attrNode && attrNode.initializer && ts.isStringLiteral(attrNode.initializer)
    ? attrNode.initializer.text
    : null;
}

function procesar(ruta) {
  const src = readFileSync(ruta, "utf8");
  const sf = ts.createSourceFile(ruta, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  let tocados = 0;

  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText() === "button") {
      const clsAttr = attr(node, "className");
      const cls = stringLit(clsAttr);
      const tipo = cls ? clasificar(cls) : null;
      if (tipo) {
        const parent = node.parent;
        const children = parent.children ?? [];
        // un solo hijo JSX (el ícono)
        const soloIcono =
          children.filter((c) => !(ts.isJsxText(c) && c.text.trim() === "")).length === 1;
        if (!soloIcono) {
          ts.forEachChild(node, visit);
          return;
        }
        const iconName = children.find((c) => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c));
        const loc = ts.isJsxElement(iconName) ? iconName.openingElement.tagName : iconName.tagName;
        const icono = loc.getText(sf);
        const ariaAttr = attr(node, "aria-label");
        const titleAttr = attr(node, "title");
        const aria = stringLit(ariaAttr) ?? stringLit(titleAttr) ?? "Acción";

        // Conserva clases que no son de layout del botón (ej. color accent).
        const extra = cls
          .replace(/\b(grid|inline-grid|inline-flex|h-\d+|w-\d+|shrink-0|place-items-center|rounded-\w+|text-neutral-\d+|text-white\/\d+|transition-colors|hover:\S+|focus-visible:\S+|disabled:\S+|border[\w/-]*|bg-\S+)\b/g, "")
          .trim();
        // Conserva props funcionales (menos className/aria-label/type que se
        // regeneran o son del primitivo).
        const conservar = node.attributes.properties
          .filter((p) => ts.isJsxAttribute(p) && ["onClick", "disabled", "title", "aria-pressed", "aria-expanded", "aria-controls"].includes(p.name.getText()))
          .map((p) => p.getText(sf));
        const titleAttrName = titleAttr ? null : "title";
        void titleAttrName;

        const attrs = [
          `aria-label="${aria}"`,
          `icon={${icono}}`,
          `variant="${tipo.variant}"`,
          tipo.size !== "md" ? `size="${tipo.size}"` : "",
          ...conservar,
          extra ? `className="${extra}"` : "",
        ].filter(Boolean);

        edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `<IconButton ${attrs.join(" ")} />` });
        // borra el closing tag + children
        const ct = parent.closingElement;
        edits.push({ start: node.getEnd(), end: ct.getEnd(), text: "" });
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
    const imp = `import { IconButton } from "@/components/ui/button";\n`;
    if (m) out = out.slice(0, m.index) + imp + out.slice(m.index);
    else out = imp + out;
  } else if (!/IconButton/.test(out.match(/import \{[^}]*\} from "@\/components\/ui\/button"/)?.[0] ?? "")) {
    out = out.replace(
      /import \{ ([^}]*) \} from "@\/components\/ui\/button";/,
      (_, names) => `import { ${names}, IconButton } from "@/components/ui/button";`,
    );
  }
  writeFileSync(ruta, out);
  return tocados;
}

let total = 0;
for (const ruta of process.argv.slice(2)) total += procesar(ruta);
console.log(`IconButtons migrados: ${total}`);
