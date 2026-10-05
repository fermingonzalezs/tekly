# 013 — Manual de usuario y tutoriales (centro de ayuda)

**Status:** HECHO en código (infra MDX + `/ayuda` + ayuda contextual + 28 artículos). Falta contenido/capturas del dueño y revisión de textos.
**Scope:** `/ayuda` (centro de ayuda público y buscable), ayuda contextual dentro de la app, artículos por sección y por rol, guías rápidas y videos. Sin cambios de datos.

## Contexto

Tekly tiene 12 secciones (Dashboard, Ventas, Inventario, Reparaciones,
Turnos, Cajas, Compras, Cuentas corrientes, Clientes, Difusión, Analíticas,
Configuración) y 3 roles con vistas distintas (admin / vendedor / técnico).
Hoy no hay documentación: el onboarding depende de que alguien explique el
sistema. El centro de ayuda sirve a tres cosas a la vez: soporte (menos
consultas), onboarding (el plan "Business" promete capacitación) y **SEO**
(cada artículo es una página indexable con búsquedas reales: "cómo cargar un
canje", "conciliar cajas", etc.).

## Decisiones (ya tomadas)

1. **Contenido en MDX dentro del repo** (`content/ayuda/<seccion>/<slug>.mdx`,
   con frontmatter: `titulo`, `resumen`, `seccion`, `roles`, `orden`,
   `actualizado`). Versionado con el código: cuando cambia una pantalla, el
   mismo PR actualiza el artículo. Sin CMS externo. Verificar `package.json`
   antes de sumar dependencias (`@next/mdx` o `next-mdx-remote` + `gray-matter`).
2. **Público e indexable** en el host de marketing (`tekly.tech/ayuda/...`),
   con `metadata` propia por artículo, entrada automática en `sitemap.ts` y
   JSON-LD `Article`/`BreadcrumbList`. Las capturas usan **datos demo**, nunca
   de una organización real.
3. **Ayuda contextual in-app**: ícono `?` (con `aria-label`) en el header de
   cada sección que abre el artículo de esa sección en una pestaña nueva
   (`/ayuda/<seccion>`), filtrado por el rol del usuario cuando aplica. Sin
   widget de chat ni tours interactivos en esta fase.
4. **Videos**: clips cortos (≤ 90 s) grabados sobre datos demo, embebidos con
   `<video preload="metadata">` o YouTube no-cookie (**no** agregar un
   reproductor de terceros sin actualizar `/cookies`, ver plan 012).

## Estructura del contenido

- **Primeros pasos** (5 artículos): crear la organización, invitar al equipo y
  roles, configurar datos del negocio y logo, cargar el inventario inicial
  (alta manual vs **importar CSV**), primera venta.
- **Una guía por sección** (la de Ventas es la referencia), siempre con la
  misma plantilla: *para qué sirve · el flujo paso a paso · errores comunes ·
  qué ve cada rol*. Temas clave a cubrir (salen del CLAUDE.md, no inventar):
  - Ventas: pago dividido, cuenta corriente, **canje** (genera una compra),
    recargos por medio de pago, eliminar venta y sus 5 opciones, garantía.
  - Inventario: equipos por IMEI, repuestos, "Otros", Recuento e Ingreso.
  - Reparaciones: tickets, checklist de ingreso/egreso, presupuesto, ítems
    (servicio/repuesto/libre), los 3 documentos imprimibles.
  - Cajas: medios de pago, **conciliación** (no hay "cerrar el día"),
    movimientos y la cotización guardada por movimiento.
  - Turnos, Compras, Cuentas corrientes, Clientes, Difusión (WhatsApp),
    Analíticas (definiciones: qué es "activo", "en riesgo", margen ponderado),
    Configuración (recibos y textos de garantía, importar datos).
- **Por rol**: "Guía del vendedor", "Guía del técnico", "Guía del admin"
  (índices que reordenan los mismos artículos).
- **Glosario** (IMEI, canje, conciliación, cuenta corriente, margen) y
  **Preguntas frecuentes** (solo preguntas reales; sin inventar).

## Pasos

### 1. Infraestructura
- `lib/ayuda.ts` (puro, con test): carga/valida el frontmatter, arma el índice
  por sección y rol, calcula artículos relacionados y siguiente/anterior.
- `app/(ayuda)/ayuda/page.tsx` (home con buscador y accesos por sección/rol),
  `app/(ayuda)/ayuda/[seccion]/[slug]/page.tsx` con `generateStaticParams` y
  `generateMetadata`. Layout con `MarketingNav`/`Footer`, tipografía de
  lectura (`max-w-[65ch]`), índice lateral de la página, "¿Te sirvió?" con
  email de soporte (sin trackeo).
- Buscador del lado cliente sobre un índice JSON generado en build (título +
  resumen + headings), sin servicio externo.
- Rutas públicas en el middleware (`ALWAYS_PUBLIC_PATHS` y, en el host de
  marketing, que `/ayuda/*` pase tal cual — ya lo hace) + `sitemap.ts` +
  quitar `/ayuda` de cualquier `disallow`.
- Componentes MDX propios (`Paso`, `Aviso`, `Captura`, `Video`) con el
  sistema de diseño (Sora, `Button`, sin gradientes nuevos).

### 2. Escribir el contenido (yo, leyendo el código)
En este orden: Primeros pasos → Ventas → Inventario → Cajas → Reparaciones →
resto. Cada artículo se valida contra el código real (nombres de botones y
campos tal cual aparecen en la UI) y se marca con `actualizado`.

### 3. Capturas y videos (dueño)
Preparar una **organización demo** (datos ficticios, ya hay dos videos de
landing: `turnos.mp4`, `movimientos_caja.mp4`). Lista de capturas necesarias
generada en el paso 2 (`<Captura>` con `alt` descriptivo y placeholder visible
hasta que exista la imagen). Capturas optimizadas (WebP, ≤ 150 KB).

### 4. Ayuda contextual in-app
- Mapa `seccion → slug` en `lib/ayuda.ts`; `IconButton` `?` en `Section`
  (opcional, prop `ayuda`), `aria-label="Abrir ayuda de <sección>"`. Respeta
  el rol: el vendedor no ve links a artículos solo-admin.
- Primer ingreso (opcional, fase 2): checklist de "Primeros pasos" en el
  Dashboard del admin recién creado.

### 5. SEO y docs
- Cada artículo: `title` ≤ 60, `description` ≤ 155, `canonical`, `Article`
  JSON-LD, links internos entre artículos. Link "Ayuda" en el nav/footer de la
  landing.
- `CLAUDE.md`: sección "Centro de ayuda" (dónde vive el contenido, plantilla,
  regla "cambió una pantalla → actualizar su artículo en el mismo PR").

## Verificación
1. `tsc` + `vitest` (`lib/ayuda.ts`: frontmatter inválido falla el build,
   índice por rol correcto, sin slugs duplicados).
2. `/ayuda` y 3 artículos cargan sin sesión, están en `sitemap.xml`, con
   `index` y metadatos propios (`curl` + revisar `<head>`).
3. Buscador encuentra "canje" y "conciliar"; a 390/360 px no hay scroll
   horizontal.
4. Revisión de contenido por el dueño (¿el flujo descripto es como lo
   explica al cliente?) antes de publicar.

## Fuera de alcance
Chat de soporte, tours interactivos dentro de la app, traducciones, base de
conocimiento privada por organización.
