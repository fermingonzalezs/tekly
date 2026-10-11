/** El `next` de un link de mail es querystring: solo se acepta una ruta
 * interna. Sin esto, `?next=https://otro-sitio` sería un open redirect. */
export function safeNextPath(
  next: string | null | undefined,
  fallback: string,
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  // `/\evil.com` lo normaliza el navegador a `//evil.com` (protocol-relative);
  // los caracteres de control (tab/CR/LF) se descartan al parsear la URL y
  // permiten armar `/<tab>/evil.com`. Una ruta interna legítima no los tiene.
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
