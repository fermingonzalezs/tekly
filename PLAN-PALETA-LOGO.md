# Plan: paleta de color + logo personalizado por organización

Este documento es el plan de implementación completo. El Paso 0 (Supabase)
**ya está aplicado** — arrancá directo del Paso 1. Este archivo es
descartable: borralo del repo cuando termines la feature (no es
documentación permanente, es un plan de handoff).

## Decisiones ya tomadas (no las reabras)

- **Paleta**: por organización (no por usuario) — la define un admin en
  Configuración → Datos del negocio, todos los usuarios de esa organización
  ven el mismo color. Coherente con que el logo y los recibos ya son por
  organización.
- **Modo**: 6 presets curados, **no** hay selector de color libre.
- **Logo**: por organización, uno solo. Se ve en el TopNav y se imprime en
  el membrete de recibos/tickets/comprobantes.
- **No tocar**: `lib/status.ts` (tonos de `Badge`), `GHOST_STRIPES`, los
  colores emerald/red de `Delta` — son semánticos (estado), no de marca. Si
  tocás alguno de estos por error, revertilo.
- No hace falta `lib/realtime.ts`/`publish()` para nada de esto: el tema se
  resuelve por request (SSR). Un usuario con la app abierta en otra pestaña
  lo ve recién al navegar/refrescar. No es un evento de tipo toast, no forces
  la unión de `AppEvent` para esto.

## ✅ Paso 0 — YA HECHO (Supabase, proyecto `tekly` / `xdfdrzxrmfpnezyeeaeq`)

Ya existen en la base real:

```sql
-- migración ya aplicada: organizations_branding
alter table organizations
  add column color_tema text not null default 'indigo',
  add column logo_url text;

alter table organizations
  add constraint organizations_color_tema_check
  check (color_tema in ('indigo','azul','verde','violeta','rosa','naranja'));
```

Y un bucket de Storage público `logos` (`storage.buckets`, `public = true`).
No hace falta ninguna policy de RLS de storage: las escrituras van a ir por
`service role` desde una server action admin-only (mismo criterio que
`updateNegocio`), y las lecturas son públicas (bucket público, sirve por CDN
sin chequear policy).

`get_advisors` (security) corrido después de la migración: mismos warnings
que ya existían antes (RPCs `security definer` + leaked password protection
pendiente) — la migración no introdujo advertencias nuevas. No hace falta
volver a correrlo por esto, sí antes de dar por terminada la migración final
si agregás alguna función nueva.

**Falta un archivo versionado**: crear
`supabase/migrations/<timestamp>_organizations_branding.sql` con el SQL de
arriba (la tabla real ya tiene los cambios aplicados vía MCP, pero el repo
necesita el archivo para que quede como referencia de lo aplicado — ver
"Migraciones de base" en CLAUDE.md). Poné un timestamp posterior al último
archivo en `supabase/migrations/`.

## Paso 1 — `lib/theme-presets.ts` (nuevo, puro, sin Supabase, con test si querés)

6 presets. Mismo "shape" que la paleta índigo actual: 5 pasos de gráfico
(oscuro→claro) + 1 fondo suave. `indigo` es **exactamente** la paleta actual
— no cambia ni un hex, es el default para no romper nada visualmente.

| id | chart[0] | chart[1] | chart[2] (=accent) | chart[3] | chart[4] | accentSoft |
|---|---|---|---|---|---|---|
| `indigo` (default) | `#2e2a5f` | `#352f86` | `#4f49bd` | `#7269d4` | `#948dde` | `#edecf8` |
| `azul` | `#1a4370` | `#225993` | `#357fd0` | `#629cda` | `#89b5e3` | `#edf2f8` |
| `verde` | `#266447` | `#32835d` | `#4aba86` | `#72caa1` | `#96d7b9` | `#edf8f3` |
| `violeta` | `#472267` | `#5e2d88` | `#8644c1` | `#a16ecf` | `#b992db` | `#f3edf8` |
| `rosa` | `#6d1d41` | `#8f2655` | `#cb3a7b` | `#d66698` | `#e08cb2` | `#f8edf2` |
| `naranja` | `#744216` | `#98561d` | `#d77c2d` | `#e09a5c` | `#e8b385` | `#f8f2ed` |

RGB triplets (para el truco de opacidad de Tailwind, ver Paso 2):

| id | accent-rgb | accent-soft-rgb |
|---|---|---|
| `indigo` | `79 73 189` | `237 236 248` |
| `azul` | `53 127 208` | `237 242 248` |
| `verde` | `74 186 134` | `237 248 243` |
| `violeta` | `134 68 193` | `243 237 248` |
| `rosa` | `203 58 123` | `248 237 242` |
| `naranja` | `215 124 45` | `248 242 237` |

Contraste texto blanco / `chart[1]` (usado como fondo de header de tabla y
de dialogs `accent`) ya verificado ≥ 4.5:1 (WCAG AA) en las 6 paletas —
no hace falta re-derivar nada, usá estos hex tal cual.

```ts
export type PaletaId = "indigo" | "azul" | "verde" | "violeta" | "rosa" | "naranja";

export type Paleta = {
  id: PaletaId;
  label: string;
  chart: [string, string, string, string, string]; // oscuro -> claro
  accentSoft: string;
  accentRgb: string;      // "R G B"
  accentSoftRgb: string;  // "R G B"
};

export const PALETAS: Paleta[] = [ /* las 6 filas de arriba */ ];

export function paletaById(id: string): Paleta {
  return PALETAS.find((p) => p.id === id) ?? PALETAS[0];
}
```

## Paso 2 — CSS vars (`app/globals.css` + `tailwind.config.js`)

En `globals.css`, `:root` define los valores de `indigo` como default:

```css
:root {
  --chart-0: #2e2a5f;
  --chart-1: #352f86;
  --chart-2: #4f49bd;
  --chart-3: #7269d4;
  --chart-4: #948dde;
  --accent-soft: #edecf8;
  --accent-rgb: 79 73 189;
  --accent-soft-rgb: 237 236 248;
}
```

Y un bloque `[data-tema="azul"] { --chart-0: ...; ... }` por cada uno de los
otros 5 presets (mismos 8 valores, de la tabla del Paso 1).

`tailwind.config.js` — extender `colors`:

```js
colors: {
  accent: {
    DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
    soft: "rgb(var(--accent-soft-rgb) / <alpha-value>)",
  },
  "table-header": "var(--chart-1)",
},
```

El `<alpha-value>` es necesario para que sigan funcionando los usos con
opacidad que ya existen (`hover:bg-accent/90`, `border-accent/40`,
`focus-visible:ring-accent/40`, etc.) — si definís `accent` como un hex o un
`var()` plano en vez de este formato `rgb(... / <alpha-value>)`, esos
modificadores de opacidad se rompen en silencio.

En `globals.css`, reemplazar:
- `th { background-color: #352f86; }` → `background-color: var(--chart-1);`
- `.recibo-print tbody tr:nth-child(even) { background-color: #edecf8; }` →
  `var(--accent-soft)`

## Paso 3 — `lib/chart.ts`

Cambiar los hex literales por referencias a las CSS vars (son strings, se
usan igual en `style={{...}}` y en atributos SVG):

```ts
export const CHART_COLORS = [
  "var(--chart-0)", "var(--chart-1)", "var(--chart-2)",
  "var(--chart-3)", "var(--chart-4)",
] as const;

export const CHART_ACCENT = "var(--chart-2)";
export const CHART_TRACK = "var(--accent-soft)";

export const HEAT_SCALE = [
  "var(--accent-soft)", "var(--chart-4)", "var(--chart-3)",
  "var(--chart-2)", "var(--chart-1)", "var(--chart-0)",
] as const;
```

`TURNO_TIPO_COLOR`, `DASH_COLORS`, `dashColor`, `DASH_ACCENT`, `DASH_HEAT`
no cambian de código (son aliases/derivados) — solo heredan los nuevos
valores automáticamente.

**No toques** `GHOST_STRIPES` (queda gris fijo, es "tramo no cumplido", no
color de marca).

Verificación puntual: `app/(app)/analiticas/analiticas-client.tsx:453-461`
usa `stopColor={CHART_ACCENT}` y `stroke={CHART_ACCENT}` como atributos SVG
(no `style`). Los navegadores modernos resuelven `var()` ahí, pero
verificalo visualmente al final (Paso 9) — si algún navegador no lo pinta,
pasar esa prop puntual a `style={{ stopColor: ... }}` / `style={{ stroke: ... }}`.

## Paso 4 — Hex hardcodeados fuera de `lib/chart.ts` (ya localizados)

`bg-[#352f86]` → `bg-table-header` en:
- `app/(app)/clientes/clientes-client.tsx:112`
- `app/(app)/difusion/difusion-client.tsx:196`
- `app/(app)/turnos/turnos-client.tsx:304`
- `app/(app)/inventario/inventario-client.tsx:616,944,1336`
- `app/(app)/cuentas-corrientes/cuentas-corrientes-client.tsx:162`
- `app/(app)/ventas/ventas-client.tsx:963`
- `app/(app)/compras/compras-client.tsx:181`
- `app/(app)/reparaciones/reparaciones-client.tsx:547`
- `components/ui/dialog.tsx:80` (`border-[#352f86] bg-[#352f86]` → `border-table-header bg-table-header`)
- `components/auth/auth-modal.tsx:17` (`border-[#352f86] bg-[#352f86]` → mismo reemplazo — queda igual visualmente porque pre-login siempre es `indigo`, pero así no queda un hex suelto)

`backgroundColor: "#edecf8"` (inline style, zebra de mini-tablas) → `"var(--accent-soft)"` en:
- `app/(app)/ventas/ventas-client.tsx:1127,1171,1855` (línea 1171 también tiene `backgroundImage: "none"`, dejala igual)
- `app/(app)/compras/compras-client.tsx:449,480`
- `app/(app)/reparaciones/reparaciones-client.tsx:864,970`

Gradiente del botón primario, `components/ui/button.tsx:25`:
```
"text-white bg-[linear-gradient(180deg,#6a63d4,#4f49bd)]"
```
→
```
"text-white bg-[linear-gradient(180deg,var(--chart-3),var(--chart-2))]"
```

**Verificación de cierre** (correr al final, antes de dar el paso por
terminado):
```
grep -rn "4f49bd\|edecf8\|352f86\|2e2a5f\|7269d4\|948dde" --include=*.tsx --include=*.ts --include=*.css .
```
No debe devolver nada fuera de `lib/theme-presets.ts` (que ahora es la única
fuente de esos hex).

## Paso 5 — Aplicar el tema en el layout raíz

Nuevo `lib/theme.ts` (`import "server-only"`):

```ts
export async function getActiveTema(): Promise<PaletaId> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "indigo";
  const { data } = await supabase
    .from("profiles")
    .select("organizations(color_tema)")
    .eq("id", user.id)
    .single();
  return (data?.organizations?.color_tema as PaletaId) ?? "indigo";
}
```

`app/layout.tsx` pasa a ser `async`:

```tsx
export default async function RootLayout({ children }) {
  const tema = await getActiveTema();
  return (
    <html lang="es" className={spaceGrotesk.variable} data-tema={tema}>
      <body>{children}</body>
    </html>
  );
}
```

**Por qué en `<html>` y no en un div dentro de `(app)/layout.tsx`**:
`ReciboDialog` (`components/recibos/recibo.tsx`) porta el recibo a
`document.body` vía `createPortal`, **fuera** del árbol que renderiza
`(app)/layout.tsx`. Si el atributo quedara en un div más adentro, el recibo
impreso no heredaría las CSS vars y siempre saldría en índigo por más que la
organización haya elegido otra paleta. Tiene que estar en `<html>` (o
`<body>`) para que todo lo que cuelgue de `document.body` —portales
incluidos— lo herede.

Páginas pre-login (`/login`, `/signup`, etc.) no tienen usuario → siempre
`"indigo"`. Es el comportamiento correcto: en un signup self-serve no hay
forma de saber la organización antes de loguearse.

## Paso 6 — Logo + tema en `Negocio`

`lib/types.ts` — agregar a `Negocio`:
```ts
colorTema: PaletaId;
logoUrl: string | null;
```

`lib/db/configuracion.ts`:
- `getNegocio()`: sumar `color_tema, logo_url` al `select`, mapear a
  `colorTema`/`logoUrl` (`logoUrl: data.logo_url ?? null`).
- `updateNegocio(data)`: sumar `color_tema: data.colorTema` al `.update()`
  (sigue siendo admin-only vía service role, mismo patrón que el resto de
  columnas de `organizations`). El logo **no** va en `updateNegocio` — tiene
  su propio flujo porque es un upload, no un campo de texto:

```ts
export async function uploadLogo(
  organizationId: string,
  file: File,
): Promise<string> {
  await requireRole("admin");
  const service = createServiceRoleClient();
  const ext = file.name.split(".").pop() || "png";
  const path = `${organizationId}/logo.${ext}`;
  const { error } = await service.storage
    .from("logos")
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = service.storage.from("logos").getPublicUrl(path);
  const { error: updateError } = await service
    .from("organizations")
    .update({ logo_url: data.publicUrl })
    .eq("id", organizationId);
  if (updateError) throw updateError;
  return data.publicUrl;
}

export async function removeLogo(organizationId: string): Promise<void> {
  await requireRole("admin");
  const service = createServiceRoleClient();
  await service
    .from("organizations")
    .update({ logo_url: null })
    .eq("id", organizationId);
  // no hace falta borrar el archivo del bucket -- el próximo upload
  // pisa el mismo path (`upsert: true`), y un archivo huérfano sin
  // referencia no genera ningún problema (bucket no factura por uso hoy).
}
```

`actions.ts` de Configuración: agregar `uploadLogoAction`/`removeLogoAction`
(`"use server"`, llaman a lo de arriba con `caller.organizationId`,
`revalidatePath("/configuracion")` al final) — mismo patrón que
`updateNegocioAction`.

## Paso 7 — UI en Configuración → Datos del negocio

En `configuracion-client.tsx`, dentro del mismo form de "Datos del negocio"
(donde ya está `objetivoMesUsd`, etc.):

- **Selector de paleta**: grid de 6 swatches clickeables (círculo/chip con
  el `chart[2]` de cada preset + label debajo), el seleccionado con un
  anillo/borde. Actualiza `form.colorTema`, se guarda junto con el resto del
  form (`updateNegocioAction`).
- **Logo**: `<input type="file" accept="image/png,image/jpeg,image/svg+xml">`
  + preview del logo actual (o un placeholder si no hay) + botón
  "Subir"/"Cambiar" que llama `uploadLogoAction` con un `FormData`, y
  "Quitar logo" (visible solo si hay `logoUrl`) que llama `removeLogoAction`.

Mismo estilo que el resto de esa sección: eyebrow con línea separadora,
`Field`/`Label` para el texto, footer de pills (header `accent`, ver la
regla de familias de `Dialog` en CLAUDE.md si esto vive dentro de un
`Dialog` en vez de inline en la página).

## Paso 8 — Consumir el logo

- `app/(app)/layout.tsx` hoy solo llama `requireUser()` — agregar
  `getNegocio()` y pasarle `negocio.logoUrl`/`negocio.nombre` a `TopNav`.
- `components/topnav.tsx`: si hay `logoUrl`, `<img src={logoUrl} alt={nombre} className="h-8 w-8 rounded-lg object-contain">` (ajustar tamaño al placeholder actual); si no, el placeholder de siempre.
- `components/recibos/recibo.tsx`: en la banda superior (donde hoy hay "un
  ícono placeholder de logo a la derecha"), si `negocio.logoUrl` existe
  mostrar `<img src={negocio.logoUrl}>` ahí (tanto en el modo normal como en
  `compacto`, ver "Recibos / PDFs" en CLAUDE.md para dónde cae cada uno).

## Paso 9 — Verificación

1. `npx tsc --noEmit`
2. `npx vitest run`
3. Levantar `npm run dev`, entrar como admin, ir a Configuración → Datos del
   negocio:
   - Cambiar de paleta, confirmar que **en la misma carga** (después de
     guardar y que la página revalide) cambian juntos: TopNav, botón
     primario, headers de tabla + zebra, gráficos de Dashboard/Analíticas/
     Clientes, dialogs con `accent`, y que un recibo impreso (preview de
     impresión, `Ctrl+P` o el botón del dialog) también cambia.
   - Confirmar que Badges/estados (colores de `lib/status.ts`) **no**
     cambian con la paleta.
   - Subir un logo, confirmar que aparece en TopNav y en un recibo
     impreso. Sacarlo, confirmar que vuelve al placeholder.
4. Repetir el chequeo visual en al menos 2 paletas más aparte de la default
   (ej. `naranja` y `verde`, las de menor contraste calculado) para
   confirmar legibilidad real, no solo el número de contraste teórico.
