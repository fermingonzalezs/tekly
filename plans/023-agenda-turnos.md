# 023 — Turnos → Agenda (estilo sistema-update)

**Status:** HECHO en código (tsc + vitest en verde, `lib/agenda.test.ts`) — **migración `supabase/migrations/20261124120000_turnos_agenda.sql` escrita pero NO aplicada** (el conector `plugin:supabase:supabase` pide autorización con `/mcp`); sin ella `/turnos` falla (columnas `duracion_min`/`atiende_id`). Falta aplicarla + `get_advisors` y la verificación en navegador con sesión. Desvío menor: Día y Semana comparten `components/agenda/calendario-grilla.tsx` en vez de dos archivos.
**Scope:** sección `app/(app)/turnos/` (pasa a mostrarse como «Agenda»), `lib/db/turnos.ts`, tipos/estados de `Turno`, una migración de `turnos`, lógica pura nueva `lib/agenda.ts` (+ test), ayuda de Turnos y `CLAUDE.md`. **Fuera de alcance**: reservas/señas y pedidos/encargos (ver "Fases siguientes").

## Referencia

La agenda de `../sistema-update` (otro proyecto, misma carpeta `proyectos/`, React + Vite, **solo lectura**: no tocar nada ahí). Archivos clave:

- `src/modules/ventas/components/agenda/AgendaSection.jsx` — layout completo: header, 4 KPIs, tabs, barra ‹ Hoy › + rango, selector Día/Semana/Mes, calendario + «Próximos».
- `CalendarioSemana.jsx`, `CalendarioDia.jsx`, `CalendarioMes.jsx`, `EventoVisual.jsx` (bloques posicionados por hora/duración, solapes, línea de "ahora", huecos de media hora clickeables), `ProximosLista.jsx`.
- `src/modules/ventas/utils/agendaUtils.js` (+ `.test.js`) — `semanaDe`, `calcularSolapes`, `agruparSolapados`, `agruparProximos`, `citasSuperpuestas`, `horaAMinutos`/`minutosAHora`.
- `src/modules/ventas/utils/agendaConstants.js` — estados de cita, `HORA_INICIO 9`, `HORA_FIN 20`, `PX_POR_HORA 56`.

Se copia **el comportamiento y la estructura**, no el estilo: todo con el sistema de diseño de tekly (`CLAUDE.md`: `Button`/`IconButton`, `Tabs`, `StatCard`, `Card`, `Dialog` vidrio + `formulario`, `ClientePicker`, acento índigo, `lib/status.ts` para estados, `fmtUsd`). Sin el slate/emerald de sistema-update. Las sucursales de sistema-update (La Plata/Mitre) **no aplican**: tekly no tiene sucursales.

## Cómo es hoy (tekly)

- `app/(app)/turnos/page.tsx` trae `listTurnosSemana()` (hoy..hoy+6) + celulares, otros, tickets listos, clientes, negocio. `turnos-client.tsx` (~1380 líneas) dibuja una grilla 7 días × 09–20 h por hora entera, con `AgendarDialog` (cliente, tipo, ticket a retirar, celulares/otros del carrito, pagos/seña, comentario) y un detalle con Confirmar/Cancelar/Eliminar.
- `Turno` (`lib/types.ts`): `dayOffset` calculado, `hora`, `tipo` (`compra|deja|retira|cotizar`), `estado` (`pendiente|confirmado|cancelado`), `ticketId`, `celularIds`, `itemsOtros`, `pagos`, `nota`. Tabla `turnos` con `fecha date` + `hora time`.
- `dayOffset` lo consumen además: `lib/dashboard.ts` (`agendaDelLocal`, `metricasEmpleado`), `lib/analiticas-resumen.ts` (`resumenTurnos`: "Sin confirmar (ya pasaron)"), `lib/command-palette.ts`, `lib/demo/seed.ts`. **No romper ese contrato** (se puede agregar `fecha`, no sacar `dayOffset`).
- Bug existente a corregir de paso: `isoHoy()`/`isoMasDias()` de `lib/db/turnos.ts` usan `toISOString()` (UTC): después de las 21 h de Argentina "hoy" es mañana. Usar `hoyISO`/`sumarDias` de `lib/date-presets.ts` (hora argentina), como el resto de la app.

## Decisiones

1. **Vistas Día / Semana / Mes** con ‹ · Hoy · › y el rango como texto ("23/11 – 28/11", "Martes 24/11", "Noviembre 2026"). Semana = **lunes a sábado** (como sistema-update; un domingo muestra la semana siguiente) — dejarlo en una constante `DIAS_SEMANA_AGENDA` por si un negocio abre domingos. En mobile (`< md`) la vista por defecto es Día.
2. **La URL manda** (mismo patrón que Ventas/Analíticas): `?vista=dia|semana|mes&fecha=YYYY-MM-DD`, parseado por `parseFiltrosAgenda` en `lib/agenda.ts` (inválido → `semana` + hoy). `page.tsx` calcula el rango visible y llama `listTurnosRango(desde, hasta)` — ya existe — en vez de `listTurnosSemana()`. «Próximos» necesita además hoy..hoy+14 y los vencidos: una segunda consulta `listTurnosProximos()` (pasados sin marcar de los últimos 30 días + próximos 14 días).
3. **Grilla por media hora** (09:00–20:00, `PX_POR_HORA` 56): cada hueco libre es un botón (`aria-label` "Agendar el 24/11 a las 10:30") que abre el alta con fecha/hora precargadas. Bloques posicionados por `hora` + `duracion_min`; superpuestos se reparten el ancho (`calcularSolapes`); en Semana, 3+ superpuestos se juntan en un bloque "N turnos" que abre ese día. Línea de "ahora" en el día de hoy.
4. **Duración**: columna nueva `duracion_min int not null default 30` con default por tipo en la UI (`compra` 30, `deja` 30, `retira` 30, `cotizar` 30 — editable en el form, Select de 15/30/45/60/90). Turnos existentes quedan en 30.
5. **Estados** (como sistema-update): `pendiente` («Sin confirmar»), `confirmado`, `atendido` (nuevo), `no_vino` (nuevo), `cancelado`. Migración del `check`. En `lib/status.ts` `turnoStatus` suma los dos. Con esto **Analíticas → Agenda pasa a medir asistencia real**: `resumenTurnos` cuenta `atendido` vs `no_vino`, y "Sin confirmar (ya pasaron)" queda para `pendiente|confirmado` pasados (se ven como **vencidos**). Actualizar el comentario de `CLAUDE.md` que decía que medir asistencia era "fuera de alcance".
6. **Quién atiende**: columna nueva `atiende_id uuid references profiles(id)` nullable + `Select` en el form (perfiles activos de la org, mismo criterio que `listTecnicos`). Aviso no bloqueante si esa persona ya tiene otro turno que se pisa (`turnosSuperpuestos`, puro). La vista Día muestra "Atiende X" / "Sin asignar".
7. **Detalle en solo lectura** al tocar un bloque (`Dialog` sin `formulario`): tipo, fecha/hora–fin, cliente + teléfono, atiende, ticket/celulares/otros/pagos (lo que ya muestra hoy), nota; acciones **Confirmar**, **Atendido**, **No vino**, **Cancelar**, **Editar**, **Eliminar** (admin). Hoy no existe editar un turno: agregar `updateTurno` en `lib/db/turnos.ts` + `updateTurnoAction` (`requireEscritura()`), reusando `AgendarDialog` con `turno` inicial (título "Editar turno"). Al editar celulares vinculados, respetar la misma regla de estados de celular que el alta (`retira` → vendido, resto → reservado) y devolver a `disponible` los que se quitan.
8. **Panel «Próximos»** a la derecha de la Semana (`xl:grid-cols-[minmax(0,1fr)_320px]`), agrupado en **Vencidos** (pasados y sin marcar, rojo, el más viejo primero) / **Hoy** / **Mañana** / **Esta semana** / **Más adelante** (`agruparProximos`, puro). Cada tarjeta abre el detalle.
9. **KPIs** (4 `StatCard` arriba): Turnos hoy · Sin confirmar (próximos) · Esta semana · Vencidos sin marcar. Sin `SeccionTabla` (no es una sección con tabla).
10. **Colores**: el color del bloque lo da el **tipo** (`turnoTipo[t.tipo].tone` → clases de `lib/status.ts`, sumar un mapa `blockClass` ahí si hace falta, nunca hex sueltos) y el **estado** la forma: `confirmado` lleno, `pendiente` con borde y fondo suave, `atendido`/`no_vino` apagado (`opacity-60`), `cancelado` borde punteado + tachado. Leyenda chica arriba del calendario.
11. **Realtime**: se mantiene `publish(...)` de `appointment_scheduled` tras crear; al marcar Atendido no se publica nada nuevo (no hay tipo de evento).
12. **Nombre**: la sección se llama «Agenda» en todos lados y la ruta pasó a `/agenda` (`app/(app)/agenda/`); `/turnos` redirige ahí (308 en `next.config.mjs`). La entidad sigue siendo «turno» y la ayuda sigue en `/ayuda/turnos`.

## Pasos

1. **Lógica pura** `lib/agenda.ts` + `lib/agenda.test.ts` (portar y adaptar de `agendaUtils.js`, con sus casos de test): `horaAMinutos`, `minutosAHora`, `semanaDe`, `rangoDeVista(vista, fecha)`, `moverFecha(vista, fecha, ±1)`, `etiquetaRango`, `calcularSolapes`, `agruparSolapados`, `agruparProximos(turnos, hoy)`, `turnosSuperpuestos(...)`, `parseFiltrosAgenda(searchParams)`. Fechas como string `YYYY-MM-DD` con aritmética local, nunca `new Date(iso)` ni `toISOString()`.
2. **Migración** `supabase/migrations/<timestamp>_turnos_agenda.sql`: `duracion_min`, `atiende_id` (+ índice), nuevo `check` de `estado`. Sin policies nuevas (la tabla ya tiene las 4 + `org_puede_escribir()`). Aplicar con `mcp__plugin_supabase_supabase__apply_migration` al proyecto `tekly` (`xdfdrzxrmfpnezyeeaeq`) y correr `get_advisors` tipo `security` (ver `CLAUDE.md` → "RLS — reglas de oro"). **Si el conector `plugin:supabase:supabase` no está autorizado** (hoy pide `/mcp`), dejá el archivo escrito, avisá al usuario y no avances con lo que depende de las columnas nuevas hasta que esté aplicada (no usar el conector `claude_ai_Supabase`: es otra cuenta).
3. **Tipos y datos**: `Turno` suma `fecha: string`, `duracionMin: number`, `atiendeId: string | null`, `atiende: string | null` (join `profiles(nombre)`); `TurnoEstado` suma `atendido | no_vino`. `lib/db/turnos.ts`: hora argentina, `listTurnosProximos`, `updateTurno`, mapeo de las columnas nuevas. Revisar que demo seed y tests que arman `Turno` compilen (sumar los campos).
4. **Página**: `page.tsx` lee `searchParams` (async), parsea, trae rango + próximos + lo que ya traía + perfiles para "Atiende". Partir `turnos-client.tsx`: `agenda-client.tsx` (shell: KPIs, barra de navegación, selector de vista con `Tabs`, cambio de URL con `router.replace` + `startTransition` y `opacity-60`), `components/agenda/` (`calendario-semana.tsx`, `calendario-dia.tsx`, `calendario-mes.tsx`, `evento-bloque.tsx`, `proximos.tsx`, `turno-detalle.tsx`) y mover `AgendarDialog` y sus campos a su propio archivo sin cambiar su comportamiento (más `duracion`/`atiende`/modo edición).
5. **Actions**: `updateTurnoAction`, `setTurnoEstadoAction` acepta los estados nuevos; todas con `requireEscritura()` y `revalidatePath("/turnos")` + `revalidatePath("/dashboard")`.
6. **Consumidores**: `resumenTurnos` (asistencia real, test actualizado), `agendaDelLocal`/`metricasEmpleado` (excluir `atendido`/`no_vino` de "próximos" igual que `cancelado`), `clientes-client.tsx` (usa `turnoStatus`, debería andar solo).
7. **Ayuda y docs**: actualizar `content/ayuda/turnos/*.mdx` (vistas, estados nuevos, editar, próximos/vencidos) y la nota de Turnos de `CLAUDE.md`. Agregar la fila 023 en `plans/README.md` y pasar el Status a lo que corresponda.

## Verificación

- `npx tsc --noEmit` y `npx vitest run` en verde.
- Navegador (dev server `crm-dev` de `.claude/launch.json`, puerto 3100): `/turnos` pide sesión — pedirle al usuario que inicie sesión **en el navegador del panel** (el login tiene Turnstile, no se puede automatizar). Probar: Día/Semana/Mes y ‹ Hoy ›; click en hueco → alta precargada; alta con duración 60 se dibuja de 2 bloques de alto; dos turnos superpuestos lado a lado; 3 superpuestos en Semana → "3 turnos" que abre el día; detalle → Atendido/No vino/Cancelar cambian el estilo; Editar; Próximos con un vencido en rojo; mobile a 375 px sin scroll horizontal de página (la Semana sí puede scrollear dentro de su card).
- Analíticas → Agenda sigue cargando y cuenta atendidos/no vino.

## Fases siguientes (no hacer ahora)

- **Reservas (señas)**: equipo del stock reservado a nombre de un cliente con seña, fecha límite de retiro, condiciones y mensaje de WhatsApp (en sistema-update: `SenaModal`, `SenasTabla`, `RetiroModal`, `agendaCondiciones.js`). En tekly se cruza con `celulares.estado = reservado` y con los pagos/seña que ya guarda un turno de compra.
- **Pedidos (encargos)**: equipo que no está en stock, con origen nacional/internacional, estados pedido → en camino → llegó → avisado → entregado (`EncargoModal`, `EncargosTabla`).
- Ambos aparecen en la fila "Todo el día" del calendario el día de retiro y en Próximos.
