# Plan: landing de Tekly (tekly.tech)

**Nota:** este plan es solo para lectura/ejecución posterior — no ejecutar
todavía. Cuando se dé la orden, se ejecuta con un agente y después se revisa.

## Objetivo

Landing de marketing simple y moderna, con animaciones de texto y parallax,
para el dominio raíz **tekly.tech**. El sistema real sigue en
**sistema.tekly.tech**, sin cambios de comportamiento para nadie que entre por
ahí.

## Decisión de arquitectura: **un solo proyecto Next.js** (este mismo repo)

Nada de proyecto/deploy separado. La landing vive **dentro** de la app actual,
como una ruta más, y el routing por dominio lo resuelve `middleware.ts`
(que ya existe y ya inspecciona cada request):

- Nueva carpeta `app/marketing/` (segmento real, no route group) con su
  propio `layout.tsx` + `page.tsx` — queda **fuera** de `app/(app)/...`, así
  que nunca pasa por el `requireUser()` de `app/(app)/layout.tsx`: la landing
  no necesita sesión.
- `middleware.ts` gana una rama nueva al principio: si el `host` de la
  request es uno de los dominios de marketing, hace **rewrite** (no redirect)
  de `/` → `/marketing` y no corre nada de la lógica de auth/cookies
  (`createMiddlewareClient`, `REMEMBER_COOKIE_NAME`, etc. — esa lógica sigue
  intacta para todo lo demás, ver "Cambios en `middleware.ts`" abajo). El
  usuario en el browser sigue viendo `tekly.tech/`, nunca `/marketing` en la
  barra de direcciones (rewrite, no redirect).
- En producción, **mismo proyecto de Vercel**, con los dos dominios atados a
  él (`tekly.tech` y `sistema.tekly.tech` → mismo deployment). Eso es
  configuración de dominio en el dashboard, no código — sigue fuera de
  alcance de este plan, lo hace el usuario a mano.
- `app/layout.tsx` (root layout — fonts, `<html>`/`<body>`, `getActiveTema()`)
  no se toca: ya carga Space Grotesk globalmente y `getActiveTema()` ya
  devuelve `"indigo"` cuando no hay usuario logueado (caso de cualquier
  visitante de la landing) — el fallback correcto ya existe, confirmado
  leyendo `lib/theme.ts`. La landing hereda esto gratis, sin lógica nueva.
- Los CTAs ("Ingresar", "Probar gratis") son links absolutos a
  `NEXT_PUBLIC_APP_URL` + `/login` / `/signup` (env var ya usada en el patrón
  del resto de la app, default `https://sistema.tekly.tech` en prod). En
  local dev, aunque la landing y el sistema corran en el mismo `npm run dev`,
  estos links siguen siendo absolutos (cruzan de "dominio de marketing" a
  "dominio de sistema" tal como pasará en producción) — no hace falta
  simular la separación de dominios para que el flujo de botones tenga
  sentido en dev.

### Cambios en `middleware.ts`

Agregar, **antes** de todo lo que ya existe (antes de crear el cliente de
Supabase, antes de tocar cookies — la landing no necesita nada de eso):

```ts
const MARKETING_HOSTNAMES = new Set([
  "tekly.tech",
  "www.tekly.tech",
  "tekly.localhost", // alias de dev, ver "Cómo probarlo en local" abajo
]);

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";
  if (MARKETING_HOSTNAMES.has(hostname)) {
    if (request.nextUrl.pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/marketing";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // ... resto del middleware actual, sin cambios ...
}
```

El `matcher` existente (`config.matcher` al final del archivo) no cambia —
ya excluye `_next/static`, `_next/image`, `favicon.ico` y extensiones de
imagen, y eso aplica igual sin importar el host.

**Alcance de esta rama nueva**: solo reescribe `/` (la home). Si alguien pide
`tekly.tech/algo-random`, cae al resto del middleware sin sesión → redirect a
`/login` (comportamiento heredado, no ideal pero aceptable para este plan —
la landing es de una sola página, no hay rutas hijas que proteger todavía).

### Cómo probarlo en local

Los navegadores modernos resuelven cualquier hostname que termina en
`.localhost` a `127.0.0.1` sin tocar `/etc/hosts` (RFC 6761). Con
`npm run dev` corriendo (puerto 3100 de siempre):

- `http://localhost:3100` → sigue siendo el CRM, exactamente como hoy. Cero
  cambio de comportamiento para el uso diario de desarrollo del sistema.
- `http://tekly.localhost:3100` → landing (gracias a `MARKETING_HOSTNAMES`).

## Stack / dependencias

- **`framer-motion`**: única dependencia nueva, se agrega al `package.json`
  de la raíz (el mismo de siempre, no hay un segundo `package.json`). Es lo
  que resuelve scroll-reveal, stagger de texto y parallax sin reinventar un
  motor de animación a mano con `IntersectionObserver`.
- Todo lo demás ya está en el repo: `lucide-react` (íconos), Tailwind 3,
  `next/font` con Space Grotesk (ya cargada en `app/layout.tsx`).
- Sin Supabase en la landing — no importa nada de `@supabase/*` ni de
  `lib/auth`/`lib/db`.

## Sistema de diseño de la landing

- **Color de marca**: `accent` (`#4f49bd`, ya definido en
  `tailwind.config.ts`) como acento principal — botón primario, links
  activos, highlights, blobs de fondo. Reusar el token existente, no
  redefinir el hex a mano en los componentes nuevos.
- **Tipografía**: `font-grotesk` (utilidad ya existente, mapea a Space
  Grotesk) para H1/H2 y números destacados; el resto en la fuente default
  (`system-ui`, ya seteada globalmente).
- **A diferencia del resto de la app, acá NO aplican las reglas "forbidden
  defaults" del sistema de diseño interno** (un solo gradiente permitido, sin
  parallax — esas reglas son para la app de gestión de uso diario intensivo,
  documentadas en `CLAUDE.md` → "Forbidden defaults"). La landing es
  marketing: gradientes de fondo, blobs, glow y parallax están bien acá,
  mientras se sientan intencionales y no genéricos (evitar el look
  "plantilla de SaaS de stock" — hero centrado + blob + 3 cards blancas sin
  personalidad; usar la skill `frontend-design` como referencia si hace
  falta inspiración).
- **Radios/espaciado**: `rounded-2xl` en cards, `rounded-full` en botones
  pill (mismo lenguaje que `Button shape="pill"`, usado hoy en `/login` y
  `/signup`).
- **Motion**: transiciones 150–300ms para hover/click; reveals de scroll
  300–600ms `ease-out`. **Implementar `prefers-reduced-motion`** (con
  `useReducedMotion` de `framer-motion`) para desactivar/reducir parallax y
  stagger — el resto de la app todavía no maneja esto en ningún lado (deuda
  conocida, documentada en `CLAUDE.md`); la landing debería ser la primera
  referencia correcta de esto en el repo, no repetir la deuda.

## Estructura de archivos a crear/tocar

```
middleware.ts                        # EDITAR: rama de host de marketing (ver arriba)
package.json                          # EDITAR: agregar framer-motion a dependencies
CLAUDE.md                             # EDITAR: documentar app/marketing/ + la rama nueva de middleware.ts (ver "Actualizar CLAUDE.md" abajo)

app/marketing/
  layout.tsx        # layout propio: NO usa TopNav ni requireUser; metadata propia (title/description de marketing, distinta a la genérica del root layout)
  page.tsx           # server component, ensambla las secciones de abajo

components/marketing/
  nav.tsx             # header sticky, logo, links a #features/#como-funciona, CTAs a NEXT_PUBLIC_APP_URL
  hero.tsx            # headline animado + subheadline + CTAs + mockup con parallax
  logos-strip.tsx      # franja de stats (ver "Contenido" abajo, no logos inventados)
  features.tsx          # grid de 6 features con scroll-reveal
  how-it-works.tsx       # 3-4 pasos, línea conectora, scroll-reveal
  showcase.tsx             # sección grande con mockup de producto y capas parallax
  cta-final.tsx             # banner de cierre con gradiente + botón grande
  footer.tsx
  ui/
    mockup-dashboard.tsx    # ilustración abstracta del dashboard (SVG/divs, NO screenshot real)
    animated-words.tsx       # helper: revela un headline palabra por palabra / char por char
    reveal.tsx                # wrapper genérico "fade+slide up al entrar en viewport"

lib/marketing/app-url.ts    # helper mínimo: NEXT_PUBLIC_APP_URL con default "https://sistema.tekly.tech" + builders de /login, /signup

.env.local.example           # EDITAR: agregar NEXT_PUBLIC_APP_URL

public/                      # no existe todavía en el repo — crear con favicon + og-image simples (placeholder, no diseño final). Al ser `public/` compartido, esto pasa a ser el favicon de TODA la app (razonable, es el mismo producto/marca)
```

## Contenido y copy (español, generic SaaS del rubro)

Redactar todo el copy — no dejar lorem ipsum. Tekly es un sistema de gestión
para **negocios de venta y reparación de iPhones** (multi-tenant, varias
organizaciones, 3 roles: admin/vendedor/técnico):

1. **Nav**: logo "Tekly", links `Producto` / `Funciones` (#features) / `Cómo
   funciona` (#como-funciona), botón "Ingresar" (outline, a
   `NEXT_PUBLIC_APP_URL/login`) + botón "Probar gratis" (primario, pill, a
   `NEXT_PUBLIC_APP_URL/signup`).
2. **Hero**: headline animado (reveal palabra por palabra o carácter por
   carácter al cargar) del estilo "Gestioná tu tienda de iPhones sin
   perderte nada". Subheadline explicando inventario + ventas + reparaciones
   + caja, todo en un solo lugar. Dos CTAs (primario "Probar gratis",
   secundario "Ver cómo funciona" con scroll a #como-funciona). Al lado o
   debajo, el `MockupDashboard` (ilustración abstracta, no screenshot real)
   con 2-3 capas que se mueven a distinta velocidad al scrollear (parallax).
3. **Franja de confianza** (`logos-strip.tsx`): como todavía no hay
   clientes/logos reales para mostrar, franja de 3-4 stats simples tipo
   "Multi-organización" / "3 roles: admin, vendedor, técnico" / "Todo en
   tiempo real" — **nunca fabricar logos de clientes o testimonios falsos**
   con nombres/empresas reales o inventadas que parezcan reales.
4. **Features** (grid de 6, ícono + título + 1-2 líneas, scroll-reveal con
   stagger): Inventario (equipos por IMEI, repuestos, otros ítems),
   Reparaciones (tickets, checklist de ingreso/egreso, presupuestos), Ventas
   (pago dividido, canje, cuenta corriente), Cajas (múltiples cajas y medios
   de pago, conciliación), Turnos (agenda semanal), Analíticas (métricas de
   negocio, clientes, márgenes en tiempo real).
5. **Cómo funciona** (3-4 pasos con línea conectora): "1. Creá tu
   organización" → "2. Invitá a tu equipo (vendedores, técnicos)" → "3.
   Cargá tu stock" → "4. Vendé, reparé y controlá todo en un solo lugar".
   Reveal secuencial al hacer scroll.
6. **Showcase**: sección grande, mockup de producto más elaborado (o el
   mismo `MockupDashboard` en otra composición) con varias capas en
   parallax (tarjetas flotantes tipo "Venta confirmada", "Turno agendado"
   simulando las notificaciones en tiempo real reales del sistema —
   `lib/realtime.ts`).
7. **CTA final**: banner ancho, fondo con gradiente índigo, titular corto +
   botón grande "Empezá gratis" → signup.
8. **Footer**: logo, © año actual Tekly, links mínimos (Producto, Ingresar,
   Probar gratis). Sin redes sociales inventadas ni links a páginas que no
   existen.

## Animaciones — detalle por sección

- **Hero headline**: `animated-words.tsx` — cada palabra (o línea) entra con
  `opacity 0 → 1` + `translateY` pequeño, stagger ~40-60ms entre palabras,
  dispara una sola vez al montar (no en cada scroll).
- **Parallax del hero/showcase**: `useScroll` + `useTransform` de
  `framer-motion` (scroll del contenedor, no listeners manuales de scroll)
  para mover 2-3 capas del mockup a distinta velocidad.
- **`reveal.tsx`**: wrapper reusable con `whileInView` (`opacity`/`y`,
  `viewport={{ once: true, margin: "-100px" }}`) — todas las secciones abajo
  del hero (features, how-it-works, showcase, cta-final) lo usan.
- **Stagger de grids** (features, pasos de how-it-works): `staggerChildren`
  en el contenedor padre vía `variants`, no delays hardcodeados por ítem.
- Nada de animación en loop infinito que distraiga (sin marquees, sin bounce
  continuo) — todo dispara una vez al entrar en viewport o al cargar la
  página, después queda quieto.
- Respetar `prefers-reduced-motion` (ver "Sistema de diseño" arriba).

## Responsive

Mobile-first acá (a diferencia del resto de la app, que es desktop-first —
una landing la mayoría la ve primero desde el celular): nav colapsa a un
menú simple (con un botón hamburguesa que muestra/oculta los links alcanza,
no hace falta un drawer animado complejo), hero y showcase pasan de layout a
dos columnas a una sola columna con el mockup abajo/arriba del texto, grid
de features de 3 columnas → 1 en mobile. Breakpoints estándar de Tailwind
(`sm`/`md`/`lg`).

## Qué NO hacer

- No tocar nada de `app/(app)/...`, `lib/auth/`, `lib/db/`, ni ninguna otra
  sección ya migrada — los únicos archivos existentes que se editan son
  `middleware.ts`, `package.json` y `.env.local.example` (ver arriba), todo
  lo demás es código nuevo en `app/marketing/`, `components/marketing/` y
  `lib/marketing/`.
- No importar nada de Supabase ni de `@supabase/*` en la landing.
- No inventar logos de clientes, testimonios con nombres/empresas (reales o
  inventadas que parezcan reales), ni números de "clientes actuales" falsos.
- No usar screenshots reales del sistema (requeriría datos de demo/login) —
  usar `MockupDashboard` (ilustración abstracta, divs/SVG, paleta
  índigo/neutros). Screenshots reales quedan como mejora futura, fuera de
  este plan.
- No dejar animaciones en loop infinito ni parallax tan agresivo que moleste
  al leer (mover como máximo ~40-60px entre capas).
- No reusar componentes de `components/ui/*` pensados para la app de
  gestión (`Button`, `Card`, `Dialog`, etc.) tal cual — la landing tiene sus
  propios componentes simples y más expresivos visualmente; sí puede
  inspirarse en la paleta/radios/tipografía de esos primitivos, pero no
  importarlos directo (son de otro contexto de uso).

## Actualizar `CLAUDE.md`

Antes de dar el trabajo por terminado, sumar unas líneas breves a
`CLAUDE.md`:

- En el árbol de "Arquitectura": agregar `app/marketing/` y
  `components/marketing/` con una línea de descripción cada uno (mismo
  formato que las entradas existentes).
- En la sección donde vive la lógica de `middleware.ts` (o una nota nueva
  cerca): mencionar la rama de host de marketing (`tekly.tech` →
  `/marketing`) para que quede documentado por qué el middleware tiene ese
  branch al principio.

No hace falta una sección larga — 4-6 líneas alcanza, siguiendo el tono y
nivel de detalle del resto del archivo.

## Pasos de implementación (orden sugerido)

1. `middleware.ts`: agregar la rama de `MARKETING_HOSTNAMES` (ver "Cambios
   en `middleware.ts`" arriba).
2. `package.json`: agregar `framer-motion`, `npm install`.
3. `.env.local.example`: agregar `NEXT_PUBLIC_APP_URL=https://sistema.tekly.tech`.
4. `lib/marketing/app-url.ts`: helper con el default y los builders de
   `/login` y `/signup`.
5. Componentes base: `components/marketing/ui/reveal.tsx`,
   `animated-words.tsx`, `mockup-dashboard.tsx`.
6. Secciones en orden: `nav.tsx` → `hero.tsx` → `logos-strip.tsx` →
   `features.tsx` → `how-it-works.tsx` → `showcase.tsx` → `cta-final.tsx` →
   `footer.tsx`.
7. `app/marketing/layout.tsx` (metadata propia) + `app/marketing/page.tsx`
   (ensambla todo).
8. Si no existe `public/` en el repo (confirmado que no existe hoy):
   crearla con un favicon y og-image simples.
9. Actualizar `CLAUDE.md` (ver sección arriba).
10. Verificar (ver checklist abajo).

## Checklist final antes de reportar terminado

- [ ] `npx tsc --noEmit` sin errores.
- [ ] `npm run build` compila sin errores.
- [ ] `git diff --stat` desde la raíz muestra como editados solo
      `middleware.ts`, `package.json`, `package-lock.json`,
      `.env.local.example` y `CLAUDE.md` — todo lo demás son archivos
      **nuevos** dentro de `app/marketing/`, `components/marketing/`,
      `lib/marketing/` y `public/` (más este mismo plan, que ya existía).
- [ ] `npm run dev`, visitar `http://localhost:3100` → sigue siendo el CRM
      sin cambios (login si no hay sesión, dashboard si la hay).
- [ ] `npm run dev`, visitar `http://tekly.localhost:3100` → landing, con la
      URL mostrando `tekly.localhost/` (rewrite, no redirect a `/marketing`).
- [ ] Probado en mobile (375px) y desktop (1440px) — nav, hero, grids no se
      rompen.
- [ ] `prefers-reduced-motion` implementado (probar con la emulación del
      navegador/devtools).
- [ ] Sin copy en inglés/lorem ipsum, sin logos/testimonios inventados.
- [ ] Botones de CTA apuntan a `NEXT_PUBLIC_APP_URL` vía
      `lib/marketing/app-url.ts`, no URLs hardcodeadas repetidas en cada
      componente.
- [ ] `CLAUDE.md` actualizado con `app/marketing/`, `components/marketing/`
      y la rama nueva de `middleware.ts`.

## Fuera de alcance de este plan

- Configuración real de dominio (atar `tekly.tech` al proyecto de Vercel,
  DNS) — lo hace el usuario a mano en el dashboard de Vercel/proveedor de
  DNS.
- Screenshots reales del producto en el showcase.
- SEO avanzado (sitemap, structured data) más allá de metadata básica.
- Sección de precios (se descartó para esta primera versión).
- Rutas hijas de marketing más allá de `/` (ej. `/precios`, `/blog`) — el
  middleware solo reescribe la home por ahora.
