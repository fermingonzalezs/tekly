# 029 — Invitar usuario sin Instagram + varios roles por usuario

**Status:** migración `20261126110000_profiles_roles_multiples` **APLICADA**
(25/11, la aplicó el usuario por SQL Editor; verificada: los 4 perfiles con
`roles = array[rol]`, trigger `profiles_roles_normalizar`, check
`profiles_roles_check`, `normalizar_roles`, `current_user_tiene_rol` y
`set_member_roles` creados; advisors security sin novedades más allá de los
WARN esperados de RPC `security definer` + leaked password protection).
**No hay que aplicar nada en la base.** Ver la fila 029 de `plans/README.md`
para el estado del código.

**Scope:**
1. Configuración → Usuarios y roles → **«Invitar usuario»** ya no pide
   Instagram.
2. Un usuario puede tener **más de un rol a la vez** (caso real: alguien que
   es **Vendedor y Técnico**). Se eligen con checkboxes al invitar y al
   editar el usuario; sus permisos son la **unión** de los permisos de cada
   rol.

**Fuera de alcance:** roles nuevos o permisos configurables, multi-org,
privacidad por columna de `costo_usd` (sigue pendiente, ver CLAUDE.md «RLS»).

Leer antes: `CLAUDE.md` (secciones «RLS — reglas de oro», «Plan y rol también
en la base», «`lib/auth/`», «Configuración», «Dashboard», «Testing») y este
plan entero.

## Estado actual (para ubicarse)

- `profiles.rol text` (uno solo: `admin | vendedor | tecnico`).
  `Rol` en `lib/auth/types.ts`, `SessionUser.rol`.
- SQL: `current_user_rol()` (`20261011200000_rls_plan_y_rol.sql`) — las
  policies solo lo comparan con `'admin'` (deletes admin-only en ~15 tablas).
  RPC `set_member_role(target, new_rol)` (`20260913000000_init_schema.sql`).
- TS: `requireRole(...roles)` / `requireRoleEscritura(...roles)`
  (`lib/auth/index.ts`, `roles.includes(session.rol)`), `navForRole`
  (`lib/nav.ts`), y ~64 lecturas de `.rol` en `app/`, `components/`, `lib/`
  (más usadas: `reparaciones/actions.ts`, `configuracion-client.tsx`,
  `user-menu.tsx`, `plan/page.tsx`, `dashboard/page.tsx`, `layout.tsx`,
  `topnav.tsx`, `ventas-client.tsx`). Listarlas con
  `grep -rn "\.rol\b" app components lib`.
- Invitación: `InvitarUsuarioDialog` (`configuracion-client.tsx` ~236) con
  `CampoInstagram`; `inviteMemberAction(email, nombre, rol, instagram)` →
  `inviteMember({ ..., rol, instagram })`.
- Cambio de rol: pill por fila → `CambiarRolDialog` / edición de miembro
  (~335–450) → `setMemberRole`.

## Decisiones (no re-decidir)

1. **Modelo: `profiles.roles text[]`** (no hay tabla N:M; son 3 valores
   fijos). Check: no vacío, sin duplicados, solo
   `admin|vendedor|tecnico`.
2. **`profiles.rol` se conserva como «rol principal» derivado**, mantenido
   por un **trigger** a partir de `roles` (`admin` si está; si no
   `tecnico` si está; si no `vendedor`). Motivo: `current_user_rol() =
   'admin'` está en ~15 policies y en código de plataforma
   (`lib/db/admin.ts`, `reportes.ts`, `admin-metrics.ts`); como solo se
   compara contra `admin`, sigue siendo correcto sin tocar ninguna policy.
   **El código de la app deja de leer `rol` para decidir permisos** — usa
   `roles`. `rol` queda solo para mostrar/ordenar donde haga falta un único
   valor (y para el SQL existente).
3. **Admin incluye todo.** En la UI, tildar «Admin» deshabilita (y deja
   tildados visualmente) Vendedor/Técnico; se guarda `['admin']`. Las
   combinaciones útiles son `['vendedor']`, `['tecnico']` y
   `['vendedor','tecnico']`.
4. **Permisos = unión.** `tieneRol(user, ...roles)` es verdadero si el
   usuario tiene **alguno**. Ej.: Vendedor+Técnico ve Compras/Cajas (las ve
   el técnico) y ve costos/margen donde hoy lo ve el técnico.
5. **Dashboard de Vendedor+Técnico**: el dashboard de empleado muestra
   **ambos** bloques (sus ventas + sus tickets). `metricasEmpleado` recibe
   los roles y concatena las métricas de cada uno (sin duplicar).
6. **Instagram**: se saca **solo del alta** (`InvitarUsuarioDialog`,
   `inviteMemberAction`, `inviteMember`). La columna `profiles.instagram`,
   su edición por el admin y en «Mi cuenta» **se quedan** (si el usuario
   pide sacarlo de todos lados, es otro plan).
7. **Último admin**: no se puede quitar el rol admin al único admin activo
   de la organización (validado en la RPC). Hoy no está validado; se agrega
   porque con checkboxes es más fácil destildarlo sin querer.

## Cambios

### 1. Migración — `supabase/migrations/20261126110000_profiles_roles_multiples.sql`

- `alter table profiles add column roles text[]`; backfill
  `update profiles set roles = array[rol]`; luego `set not null` y check:
  `cardinality(roles) between 1 and 3 and roles <@ array['admin','vendedor','tecnico']`
  (+ sin duplicados: `cardinality(roles) = cardinality(array(select distinct unnest(roles)))`
  vía función inmutable o trigger, lo que resulte más simple).
- Trigger `before insert or update of roles` que normaliza (si contiene
  `admin` → `['admin']`; ordena) y setea `rol` (Decisión 2). Un insert que
  solo mande `rol` (código viejo / signup) debe seguir funcionando: si
  `roles` viene null, usar `array[rol]`.
- Nueva función `current_user_tiene_rol(r text) returns boolean`
  (`security definer`, `stable`, `search_path = public`, lee `profiles` del
  `auth.uid()` activo; grants igual que `current_user_rol`). No reemplaza
  policies existentes; queda para lo nuevo.
- Nueva RPC **`set_member_roles(target_profile_id uuid, new_roles text[])`**
  (`security definer`): caller admin, misma org, roles válidos, y
  Decisión 7 (si el target es admin y `new_roles` no tiene `admin`, que
  quede otro admin activo en la org). Grants: revoke public, grant
  authenticated. **Dejar `set_member_role`** funcionando (escribe
  `roles = array[new_rol]`) hasta que no quede código que la llame; se puede
  dropear en un plan posterior.
- Aplicar con `mcp__plugin_supabase_supabase__apply_migration` (proyecto
  `tekly`) **solo con OK del usuario**; después `get_advisors` security: los
  únicos WARN nuevos esperables son los de RPC `security definer` llamables
  por `authenticated` (intencional, CLAUDE.md lo acepta).

### 2. Tipos y sesión — `lib/auth/`

- `types.ts`: `SessionUser.roles: Rol[]` (dejar `rol: Rol` = principal, con
  comentario «solo para mostrar; permisos → `roles`/`tieneRol`»).
- Nuevo `lib/roles.ts` puro + `lib/roles.test.ts`: `tieneRol(user, ...r)`,
  `normalizarRoles(roles)` (dedupe, admin absorbe, orden fijo
  admin/vendedor/tecnico, error si vacío), `rolPrincipal(roles)`,
  `etiquetaRoles(roles)` («Vendedor y técnico»). Tests de cada uno.
- `index.ts`: `getSession` selecciona `roles`; `requireRole`/
  `requireRoleEscritura` usan `tieneRol`. `inviteMember({ email, nombre,
  roles })` (sin `instagram`; valida con `normalizarRoles`; inserta
  `roles`). `setMemberRoles(id, roles)` → RPC `set_member_roles`. El signup
  sigue creando `['admin']`.
- `inviteMember` cuenta cupo igual que hoy (no cambia).

### 3. Reemplazar lecturas de `.rol` para permisos

Recorrer `grep -rn "\.rol\b" app components lib` y, archivo por archivo:
- `rol === "admin"` → `tieneRol(user, "admin")`.
- `rol === "vendedor"` usado para **restringir** (ocultar costo, margen,
  etc.) → `!tieneRol(user, "admin", "tecnico")` — así Vendedor+Técnico **sí**
  ve lo que ve el técnico (Decisión 4). Revisar con cuidado cada caso:
  `ventas/page.tsx` (borra margen/ganancia), `ventas-client.tsx`
  (`puedeVerCosto`), `reparaciones/actions.ts` + `page.tsx`
  (`ticketParaRol`), `agenda/page.tsx`, `inventario-client.tsx`,
  `cajas`/`compras`/`cuentas-corrientes`/`recuentos`/`clientes` clients.
- `lib/nav.ts`: `navForRole(roles: Rol[])` → ítem visible si comparte algún
  rol. Actualizar `lib/nav.test.ts` con un caso Vendedor+Técnico.
- `dashboard/page.tsx` + `lib/dashboard.ts`: Decisión 5; test nuevo en
  `lib/dashboard.test.ts`.
- `ayuda` (`articuloDeSeccion` filtra por rol): aceptar `roles[]`.
- Mostrar el rol (`user-menu.tsx`, `topnav.tsx`, `realtime` actor
  `` `${user.nombre} (${...})` ``): usar `etiquetaRoles(user.roles)`.
- Panel de plataforma (`lib/db/admin.ts`, `reportes.ts`,
  `admin-metrics.ts`, `admin/organizaciones/[id]`): puede seguir leyendo
  `rol` (principal) para listar; mostrar `etiquetaRoles` si trae `roles`.
- `lib/mock-data.ts` / demo (`lib/demo/usuario.ts`): agregar `roles:
  ["admin"]` donde se arme un `SessionUser`.

### 4. Configuración — `app/(app)/configuracion/`

- **`InvitarUsuarioDialog`**: sacar `CampoInstagram`, su estado y
  `errorInstagram`. Reemplazar el selector de rol por **3 checkboxes**
  (Admin / Vendedor / Técnico) con Decisión 3; al menos uno tildado para
  habilitar «Invitar». Default: Vendedor.
- `actions.ts`: `inviteMemberAction(email, nombre, roles: Rol[])`;
  `setMemberRolesAction(id, roles)` (admin, `requireRoleEscritura("admin")`
  o lo que use hoy `setMemberRole`), revalida con `normalizarRoles`.
- Tabla de usuarios: la columna/pill de rol muestra un chip por rol
  (patrón chip gris + punto `dotClass[rolTone[r]]`, CLAUDE.md «Estados y
  etiquetas»), o `etiquetaRoles` si queda más limpio. El pill abre el
  diálogo de cambio de roles con los mismos checkboxes (reemplaza el select
  de `CambiarRolDialog` / la edición de miembro ~335–450). Mostrar el error
  de «último admin» dentro del dialog.
- Instagram del miembro en la tabla y en su edición: **se queda**
  (Decisión 6).

### 5. Ayuda y docs

- `content/ayuda/configuracion/` (artículo de usuarios/roles e invitación):
  varios roles, sin Instagram al invitar; subir `actualizado`.
- `CLAUDE.md`: «Modelo de datos» (`profiles.roles text[]`, `rol` =
  principal derivado por trigger), «RLS» (`current_user_tiene_rol`,
  `set_member_roles`), «`lib/auth/`» (`tieneRol`, `requireRole` = alguno),
  «Configuración» (checkboxes; Instagram fuera del alta), «Dashboard»
  (empleado con ambos roles).
- `plans/README.md`: fila 029 + Status de este archivo al terminar.

## Verificación

1. `npx tsc --noEmit` y `npx vitest run` en verde (tests nuevos de
   `lib/roles.ts`, nav y dashboard).
2. Migración aplicada (con OK) + advisors. Chequear en SQL que todos los
   perfiles quedaron con `roles = array[rol]`.
3. En el navegador con sesión de admin (el usuario se loguea; **no tipear
   contraseñas**): invitar sin campo Instagram; cambiar un usuario a
   Vendedor+Técnico; intentar quitar admin al único admin → error. Con OK
   del usuario, entrar con un usuario Vendedor+Técnico y comprobar: nav con
   Compras/Cajas, costos visibles en Ventas, dashboard con ventas y tickets,
   sin acceso a Analíticas/Configuración. Sin errores en consola.
4. `graphify update .` si está instalado.

## Cuidado

- Cambio transversal: muchos archivos los editan otras sesiones. Releer
  justo antes de cada edición y hacer cambios puntuales.
- Ningún permiso puede quedar **más abierto** para un usuario de un solo
  rol que antes: un Vendedor solo sigue sin ver costos/margen ni las
  secciones de admin/técnico. Revisar cada reemplazo de `.rol`.
- No commitear sin que el usuario lo pida. No `git stash` ni `checkout`.
