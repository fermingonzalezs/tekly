/** Usuario de Instagram de un perfil de Tekly (`profiles.instagram`). Es solo
 * texto: Instagram no tiene API pública para buscar/validar cuentas
 * personales, así que se guarda el nombre limpio y se muestra como link. */

export const INSTAGRAM_MAX = 30;

/** Mismas reglas que Instagram: letras, números, `.` y `_`, hasta 30, sin
 * punto al principio/al final ni dos seguidos. Minúsculas (Instagram no
 * distingue). Tiene su espejo en el CHECK de `profiles.instagram`. */
const FORMATO = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/;

export type InstagramResultado =
  | { ok: true; usuario: string | null }
  | { ok: false; error: string };

/** Acepta `@usuario`, `usuario` o el link al perfil
 * (`https://www.instagram.com/usuario/?igsh=…`). Vacío = sin Instagram. */
export function normalizarInstagram(entrada: string | null | undefined): InstagramResultado {
  let s = (entrada ?? "").trim();
  if (!s) return { ok: true, usuario: null };

  const link = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/([^/?#\s]+)/i);
  if (link) s = link[1];
  else if (/[/:]/.test(s)) return { ok: false, error: "Ese link no es de un perfil de Instagram." };

  s = s.replace(/^@+/, "").toLowerCase();
  if (s.length > INSTAGRAM_MAX) {
    return { ok: false, error: `El usuario de Instagram tiene hasta ${INSTAGRAM_MAX} caracteres.` };
  }
  if (!FORMATO.test(s)) {
    return {
      ok: false,
      error: "Usuario de Instagram inválido: solo letras, números, «.» y «_» (sin punto al principio, al final ni dos seguidos).",
    };
  }
  return { ok: true, usuario: s };
}

export function instagramUrl(usuario: string): string {
  return `https://www.instagram.com/${usuario}/`;
}
