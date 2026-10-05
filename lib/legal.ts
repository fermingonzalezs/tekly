/**
 * Textos legales (plan 012): versión vigente, estado del borrador y datos de
 * contacto de Tekly. Los textos viven en `app/(legal)/*`.
 *
 * `LEGAL_BORRADOR`: mientras sea `true` las páginas muestran el aviso de
 * borrador, van con `noindex`, no están en el sitemap y **no se obliga a los
 * usuarios existentes a re-aceptar**. Pasarlo a `false` recién cuando el
 * abogado revisó los textos y se completaron los datos de `EMPRESA`.
 */
export const LEGAL_BORRADOR = true;

/** Versión del texto aceptado (se guarda en `profiles.terminos_version`).
 * Subirla cuando cambien los Términos o la Privacidad. */
export const TERMINOS_VERSION = "2026-10-05";

/** Fecha legible de la última actualización (se muestra en las páginas). */
export const LEGAL_ACTUALIZADO = "5 de octubre de 2026";

/** Datos de Tekly. Los `[...]` son pendientes del dueño (plan 012,
 * "Decisiones"): completar antes de publicar. */
export const EMPRESA = {
  razonSocial: "[RAZÓN SOCIAL — completar]",
  cuit: "[CUIT — completar]",
  domicilio: "[DOMICILIO LEGAL — completar]",
  email: "[EMAIL DE CONTACTO LEGAL — completar]",
};

/** Plazos de la Ley 25.326 (días hábiles) para ejercer derechos. */
export const PLAZOS_DERECHOS = { acceso: 10, rectificacionSupresion: 5 };

/** ¿Este usuario tiene que (re)aceptar los términos vigentes? Solo cuando los
 * textos ya están publicados (`!LEGAL_BORRADOR`). */
export function requiereAceptarTerminos(
  terminosVersion: string | null | undefined,
  borrador: boolean = LEGAL_BORRADOR,
): boolean {
  if (borrador) return false;
  return terminosVersion !== TERMINOS_VERSION;
}
