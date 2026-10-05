import type { Metadata } from "next";
import { LEGAL_BORRADOR } from "@/lib/legal";

/** Metadata de una página legal: indexable solo cuando el texto ya no es
 * borrador (el root layout es `noindex`). */
export function legalMetadata(titulo: string, descripcion: string, ruta: string): Metadata {
  return {
    title: `${titulo} — Tekly`,
    description: descripcion,
    alternates: { canonical: `https://tekly.tech${ruta}` },
    robots: LEGAL_BORRADOR ? { index: false, follow: false } : { index: true, follow: true },
  };
}
