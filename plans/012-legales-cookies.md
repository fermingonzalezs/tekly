# 012 — Legales: Términos y condiciones, Privacidad y Cookies

**Status:** IMPLEMENTADO como borrador (`LEGAL_BORRADOR = true` en `lib/legal.ts`) — falta completar `EMPRESA`, decisiones 1-6 y **revisión de un abogado**; recién ahí pasar `LEGAL_BORRADOR` a `false`
**Scope:** páginas públicas `/terminos`, `/privacidad`, `/cookies`, aceptación en `/signup`, aviso de cookies, footer de la landing. Sin cambios en el modelo de negocio.

## Contexto

Tekly es un SaaS multi-tenant: cada negocio (organización) carga datos de
**sus propios clientes** (nombre, teléfono, email, fecha de nacimiento,
historial de compras/reparaciones, IMEI). Eso define los roles legales:

- **Tekly** es *responsable* de los datos de las cuentas que se registran
  (admins/usuarios: nombre, email) y *encargado de tratamiento* de los datos
  de clientes finales que cada negocio sube.
- **Cada negocio** es *responsable* de los datos de sus clientes finales.
- Subencargados reales hoy: Supabase (base y Auth, `sa-east-1`), el hosting de
  la app, Cloudflare Turnstile (anti-bots en login/signup/forgot-password) y
  dolarapi.com (cotización, sin datos personales).

Marco aplicable (Argentina): Ley 25.326 de Protección de Datos Personales
(registro de bases ante la AAIP, derechos de acceso/rectificación/supresión,
transferencia internacional — Supabase está en Brasil, país sin nivel de
protección "adecuado" reconocido: se necesita cláusula contractual o
consentimiento), Ley 24.240 de Defensa del Consumidor (cláusulas abusivas,
botón de baja, información clara de precios) y Ley 26.951 si hubiera
contacto comercial. **Los borradores no reemplazan a un abogado: el plan
termina con su revisión.**

Cookies/almacenamiento reales hoy (verificado en el código — **no hay
analytics ni marketing**):
- Cookies de sesión de Supabase Auth (`sb-*`) y `tekly-remember`
  (`REMEMBER_COOKIE_NAME`): **estrictamente necesarias**.
- Cloudflare Turnstile en 3 formularios: necesaria (seguridad); carga un
  script de un tercero.
- `localStorage`: `tekly:ui:<id>` (visibilidad de gráficos/tarjetas) y el tema:
  preferencias de interfaz, necesarias para la función pedida.
- Landing: ninguna cookie propia ni de terceros hoy.

Consecuencia: **no hace falta un banner de consentimiento con "aceptar/
rechazar" mientras no se sumen analytics/marketing**; alcanza una página
`/cookies` clara + aviso informativo en el primer ingreso. Si se agrega
Google Analytics, Meta Pixel, Hotjar, etc., este plan se reabre (banner con
consentimiento previo y bloqueo de scripts).

## Decisiones que necesita del dueño (bloquean el texto final)

1. Razón social, CUIT, domicilio legal y email de contacto legal de Tekly.
2. ¿Plan de pago real o todo gratis por ahora? (condiciona la cláusula de
   precios, facturación, renovación y baja).
3. Política de retención: ¿cuánto tiempo se guardan los datos tras una baja?
   (propuesta: 30 días de gracia y borrado definitivo a los 90).
4. ¿Tekly accede a los datos de un negocio? (hoy existe el panel `/admin`
   de plataforma: declarar para qué se usa — soporte — y que queda auditado).
5. Jurisdicción y ley aplicable (propuesta: Argentina, tribunales ordinarios
   de la Ciudad Autónoma de Buenos Aires — confirmar con el abogado).
6. ¿Inscripción de la base ante la AAIP? (la hace el responsable; consultar al
   abogado si Tekly debe inscribir la de usuarios).

## Pasos

### 1. Redactar (yo) — borradores en `content/legal/*.md`
- **Términos y condiciones**: objeto del servicio, registro y cuentas
  (un usuario = una organización, roles), uso aceptable, planes/precios y
  facturación (según decisión 2), propiedad de los datos (son del negocio) y
  licencia limitada a Tekly para operarlos, disponibilidad y soporte sin
  garantía de 100 %, backups, responsabilidad limitada, suspensión/baja y
  exportación de datos, modificaciones con aviso previo, ley y jurisdicción.
  Aclarar que **los documentos que emite el sistema (recibos, garantías,
  tickets) son del negocio, no de Tekly, y no son facturas fiscales** (ya lo
  dicen los PDF: "Documento no válido como factura").
- **Política de privacidad**: qué datos, finalidad, base legal, roles
  (responsable vs encargado), subencargados y transferencia internacional,
  seguridad (RLS por organización, cifrado en tránsito), retención, derechos
  y cómo ejercerlos (email + plazos de la Ley 25.326: 10 días hábiles
  acceso, 5 rectificación/supresión), AAIP como autoridad de control.
- **Política de cookies**: tabla de lo real (arriba), con nombre, propósito,
  duración y si es de tercero.
- Anexo opcional: **acuerdo de encargado de tratamiento (DPA)** breve para
  que cada negocio lo acepte al registrarse.

### 2. Páginas públicas
- `app/(legal)/terminos/page.tsx`, `privacidad`, `cookies`: renderizan el
  markdown (MDX o `react-markdown`; verificar `package.json` antes de agregar
  dependencias) con layout simple de landing (`MarketingNav`/`Footer`),
  fecha de "última actualización" y versión visible.
- Son **públicas e indexables**: `robots: { index: true }`, entrada en
  `app/sitemap.ts`, quitar de `disallow` si hiciera falta. Importante: deben
  servirse en **ambos hosts** o redirigir al de marketing; definir en
  `middleware.ts` (hoy en `tekly.tech` solo `/` se reescribe y el resto pasa
  tal cual — las rutas existen en el mismo deploy) y en la app deben ser
  rutas públicas sin sesión (agregar a `ALWAYS_PUBLIC_PATHS`).
- Footer de la landing: links a las tres páginas (hoy el footer dice
  explícitamente "sin links a páginas que no existen" — actualizar ese
  comentario).

### 3. Aceptación en el registro
- `/signup`: checkbox obligatorio "Acepto los Términos y la Política de
  Privacidad" (links a las páginas), validado en `lib/auth/validation.ts` (zod)
  **y** en la server action.
- Persistir la aceptación: migración con `profiles.terminos_version text` y
  `profiles.terminos_aceptados_at timestamptz` (o tabla
  `aceptaciones_legales`), sin tocar RLS (las columnas las escribe el signup
  por service role, mismo patrón que el resto). Guardar la **versión**
  aceptada (`TERMINOS_VERSION` en `lib/legal.ts`).
- Invitados (`inviteMember`): aceptan al confirmar la invitación (pantalla
  `/auth/confirm/hash` o primer ingreso) — mismo registro.
- Cuando cambie la versión: aviso bloqueante al próximo ingreso para
  re-aceptar (opcional, fase 2).

### 4. Aviso de cookies (informativo)
- Banner discreto de una línea en la **landing** y en el login/signup
  ("Usamos solo cookies necesarias… [Más info]") con "Entendido", recordado
  en `localStorage` (`tekly:cookies-aviso`, con try/catch). Sin botón de
  rechazo mientras no haya cookies no esenciales. Usar `Button` del sistema.

### 5. Derechos del titular y baja
- Email de contacto legal visible en la política. Fase 2 (producto):
  "Exportar mis datos" y "Eliminar mi organización" en Configuración (admin) —
  requiere decisión 3 y su propio plan.

### 6. Docs
- `CLAUDE.md`: sección "Legales" (dónde viven los textos, `TERMINOS_VERSION`,
  que cualquier cookie/script de terceros nuevo obliga a actualizar
  `/cookies` y reabrir el banner).

## Verificación
1. `tsc` + `vitest` (test del schema de signup: sin checkbox → error).
2. Las 3 páginas cargan sin sesión en el host de la app y en el de marketing;
   están en `sitemap.xml` y con `index`.
3. Signup sin aceptar → rechazado en cliente **y** servidor; con aceptar →
   `terminos_version`/`terminos_aceptados_at` guardados.
4. **Revisión del abogado** y ajustes → recién ahí se publica y se avisa a los
   usuarios existentes.

## Fuera de alcance
Facturación electrónica/AFIP, contratos a medida por cliente, banner de
consentimiento granular (se activa si se agregan analytics).
