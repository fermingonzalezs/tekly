import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Rol } from "@/lib/auth/types";

/** Índice y carga de artículos del centro de ayuda. Lee `content/ayuda/**`
 * (fs), así que es **server-only** en la práctica: sólo lo importan los
 * server components de `app/(ayuda)/ayuda`. Se mantiene sin `import
 * "server-only"` para poder testear la lógica pura (parseo, índice, búsqueda)
 * con vitest en node. */

/** Secciones de la app que tienen guía. El orden es el del menú. */
import {
  SECCIONES_AYUDA,
  SECCION_LABEL,
  type SeccionAyuda,
} from "@/lib/ayuda-secciones";

export { SECCIONES_AYUDA, SECCION_LABEL };
export type { SeccionAyuda };

const ROLES: Rol[] = ["admin", "vendedor", "tecnico"];

export type ArticuloMeta = {
  /** `content/ayuda/<seccion>/<slug>.mdx` → `${seccion}/${slug}`. */
  id: string;
  seccion: SeccionAyuda;
  slug: string;
  titulo: string;
  resumen: string;
  /** Vacío = para todos los roles. */
  roles: Rol[];
  orden: number;
  actualizado: string;
  url: string;
};

export type Articulo = ArticuloMeta & {
  /** Cuerpo MDX crudo, sin frontmatter. */
  cuerpo: string;
  /** Path absoluto al archivo `.mdx` (para import dinámico). */
  archivo: string;
};

const CONTENT_DIR = path.join(process.cwd(), "content", "ayuda");

function esSeccion(v: string): v is SeccionAyuda {
  return (SECCIONES_AYUDA as readonly string[]).includes(v);
}

function parseRoles(raw: unknown): Rol[] {
  if (raw == null || raw === "") return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(",");
  const out: Rol[] = [];
  for (const r of arr) {
    const t = String(r).trim().toLowerCase();
    if ((ROLES as string[]).includes(t)) out.push(t as Rol);
    else if (t && t !== "todos")
      throw new Error(`Rol inválido en frontmatter: "${r}"`);
  }
  return out;
}

function parseArticulo(archivo: string): Articulo {
  const raw = fs.readFileSync(archivo, "utf8");
  const { data, content } = matter(raw);
  const rel = path.relative(CONTENT_DIR, archivo).replace(/\.mdx$/, "");
  const [seccion, slug] = rel.split(path.sep);
  if (!seccion || !slug) throw new Error(`Ruta de artículo inválida: ${archivo}`);
  if (!esSeccion(seccion))
    throw new Error(`Sección desconocida en ${archivo}: "${seccion}"`);

  for (const campo of ["titulo", "resumen"] as const) {
    if (!data[campo] || typeof data[campo] !== "string")
      throw new Error(`Falta "${campo}" en ${archivo}`);
  }
  // YAML parsea `actualizado: 2026-10-04` como Date; normalizamos a ISO.
  const actualizado = data.actualizado
    ? data.actualizado instanceof Date
      ? (data.actualizado as Date).toISOString().slice(0, 10)
      : String(data.actualizado)
    : "";
  if (!actualizado) throw new Error(`Falta "actualizado" en ${archivo}`);

  return {
    id: `${seccion}/${slug}`,
    seccion,
    slug,
    titulo: data.titulo,
    resumen: data.resumen,
    roles: parseRoles(data.roles),
    orden: Number.isFinite(Number(data.orden)) ? Number(data.orden) : 999,
    actualizado,
    url: `/ayuda/${seccion}/${slug}`,
    cuerpo: content.trim(),
    archivo,
  };
}

function recorrer(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...recorrer(full));
    else if (e.name.endsWith(".mdx") && !e.name.startsWith("_")) out.push(full);
  }
  return out;
}

/** Todos los artículos, ordenados por sección (orden del menú) y `orden`. */
export function listArticulos(): Articulo[] {
  const arts = recorrer(CONTENT_DIR).map(parseArticulo);
  return arts.sort((a, b) => {
    const s = SECCIONES_AYUDA.indexOf(a.seccion) - SECCIONES_AYUDA.indexOf(b.seccion);
    return s !== 0 ? s : a.orden - b.orden || a.titulo.localeCompare(b.titulo);
  });
}

export function getArticulo(seccion: string, slug: string): Articulo | null {
  return listArticulos().find((a) => a.seccion === seccion && a.slug === slug) ?? null;
}

/** Artículo de una sección para la ayuda contextual (`?` en el header).
 * Devuelve el primero visible para ese rol, o null. */
export function articuloDeSeccion(
  seccion: SeccionAyuda,
  rol?: Rol,
): Articulo | null {
  const arts = listArticulos().filter((a) => a.seccion === seccion);
  if (arts.length === 0) return null;
  if (!rol) return arts[0];
  return arts.find((a) => a.roles.length === 0 || a.roles.includes(rol)) ?? null;
}

/** Artículos agrupados por sección (solo secciones con artículos). */
export function indicePorSeccion(rol?: Rol): {
  seccion: SeccionAyuda;
  label: string;
  articulos: ArticuloMeta[];
}[] {
  const arts = listArticulos().filter(
    (a) => !rol || a.roles.length === 0 || a.roles.includes(rol),
  );
  return SECCIONES_AYUDA.flatMap((s) => {
    const de = arts.filter((a) => a.seccion === s);
    if (de.length === 0) return [];
    return [
      {
        seccion: s,
        label: SECCION_LABEL[s],
        articulos: de.map(({ cuerpo: _c, archivo: _a, ...meta }) => meta),
      },
    ];
  });
}

/** Artículos de una guía de rol (sección `roles`), reordenando el resto. */
export function guiasDeRol(rol: Rol): ArticuloMeta[] {
  return listArticulos()
    .filter((a) => a.seccion === "roles" && (a.roles.length === 0 || a.roles.includes(rol)))
    .map(({ cuerpo: _c, archivo: _a, ...meta }) => meta);
}

/** Anterior / siguiente dentro de la misma sección. */
export function vecinos(art: Articulo): {
  anterior: ArticuloMeta | null;
  siguiente: ArticuloMeta | null;
} {
  const de = listArticulos().filter((a) => a.seccion === art.seccion);
  const i = de.findIndex((a) => a.id === art.id);
  const meta = ({ cuerpo: _c, archivo: _a, ...m }: Articulo) => m;
  return {
    anterior: i > 0 ? meta(de[i - 1]) : null,
    siguiente: i >= 0 && i < de.length - 1 ? meta(de[i + 1]) : null,
  };
}

/** Relacionados: mismo `seccion` (excluyendo el actual) o que compartan al
 * menos un rol explícito; máximo 3. */
export function relacionados(art: Articulo, max = 3): ArticuloMeta[] {
  const meta = ({ cuerpo: _c, archivo: _a, ...m }: Articulo) => m;
  const arts = listArticulos().filter((a) => a.id !== art.id);
  const puntaje = (a: Articulo) => {
    let p = 0;
    if (a.seccion === art.seccion) p += 3;
    p += a.roles.filter((r) => art.roles.includes(r)).length;
    return p;
  };
  return arts
    .map((a) => ({ a, p: puntaje(a) }))
    .filter(({ p }) => p > 0)
    .sort((x, y) => y.p - x.p || x.a.titulo.localeCompare(y.a.titulo))
    .slice(0, max)
    .map(({ a }) => meta(a));
}

/** Buscador: título + resumen + headings del cuerpo. Devuelve los que
 * matchean, priorizando títulos. */
export function buscar(consulta: string, rol?: Rol): ArticuloMeta[] {
  const q = consulta.trim().toLowerCase();
  if (!q) return [];
  const arts = listArticulos().filter(
    (a) => !rol || a.roles.length === 0 || a.roles.includes(rol),
  );
  const meta = ({ cuerpo: _c, archivo: _a, ...m }: Articulo) => m;
  return arts
    .map((a) => {
      const enTitulo = a.titulo.toLowerCase().includes(q) ? 2 : 0;
      const enResumen = a.resumen.toLowerCase().includes(q) ? 1 : 0;
      const enCuerpo = a.cuerpo.toLowerCase().includes(q) ? 0.5 : 0;
      return { a, score: enTitulo + enResumen + enCuerpo };
    })
    .filter(({ score }) => score > 0)
    .sort((x, y) => y.score - x.score || x.a.titulo.localeCompare(y.a.titulo))
    .map(({ a }) => meta(a));
}

/** Índice plano para el buscador del cliente + `generateStaticParams`. */
export function indicePlano(): ArticuloMeta[] {
  return listArticulos().map(({ cuerpo: _c, archivo: _a, ...meta }) => meta);
}

/** Slug de un heading (mismo cálculo para el `id` renderizado y el índice). */
export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Headings `##`/`###` del cuerpo, para el índice lateral del artículo. */
export function headings(cuerpo: string): { nivel: 2 | 3; texto: string; id: string }[] {
  const out: { nivel: 2 | 3; texto: string; id: string }[] = [];
  let enCode = false;
  for (const linea of cuerpo.split("\n")) {
    if (linea.trim().startsWith("```")) enCode = !enCode;
    if (enCode) continue;
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(linea);
    if (!m) continue;
    const texto = m[2].replace(/[*_`]/g, "");
    out.push({ nivel: m[1].length as 2 | 3, texto, id: slugify(texto) });
  }
  return out;
}
