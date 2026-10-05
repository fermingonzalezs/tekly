/**
 * Secciones del centro de ayuda y sus etiquetas: módulo **puro** (sin `fs`),
 * importable desde componentes cliente (ej. el `?` de la Topbar). El lector de
 * artículos (`lib/ayuda.ts`) usa `node:fs` y solo corre en el server.
 */

export const SECCIONES_AYUDA = [
  "primeros-pasos",
  "dashboard",
  "ventas",
  "inventario",
  "recuentos",
  "reparaciones",
  "turnos",
  "cajas",
  "compras",
  "cuentas-corrientes",
  "clientes",
  "difusion",
  "analiticas",
  "configuracion",
  "herramientas",
  "roles",
  "glosario",
  "faq",
] as const;

export type SeccionAyuda = (typeof SECCIONES_AYUDA)[number];

export const SECCION_LABEL: Record<SeccionAyuda, string> = {
  "primeros-pasos": "Primeros pasos",
  dashboard: "Dashboard",
  ventas: "Ventas",
  inventario: "Inventario",
  recuentos: "Recuentos",
  reparaciones: "Reparaciones",
  turnos: "Turnos",
  cajas: "Cajas",
  compras: "Compras",
  "cuentas-corrientes": "Cuentas corrientes",
  clientes: "Clientes",
  difusion: "Difusión",
  analiticas: "Analíticas",
  configuracion: "Configuración",
  herramientas: "Herramientas",
  roles: "Guías por rol",
  glosario: "Glosario",
  faq: "Preguntas frecuentes",
};
