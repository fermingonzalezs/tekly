# 017 — Manual de usuario completo (operaciones, límites y FAQ por sección)

**Status:** HECHO (contenido). 73 artículos (43 nuevos), guías de sección con FAQ + «Qué no se puede», matriz de permisos, glosario y FAQ transversales. El bloqueo de render que reportó el informe (500 en todos los artículos) **se resolvió el 2026-10-17** con `transpilePackages: ["next-mdx-remote"]` en `next.config.mjs`; los 74 artículos responden 200 en local.
**Scope:** solo contenido: `content/ayuda/**/*.mdx` (+ ajustes mínimos a `lib/ayuda.test.ts` si hace falta). Sin cambios de datos ni de UI de la app.

## Contexto

El centro de ayuda (plan 013) ya tiene la infraestructura (MDX, `/ayuda`, `?` contextual, buscador, JSON-LD) y 30 artículos **cortos** (20–50 líneas cada uno, una `guia.mdx` por sección). Son un esqueleto: no explican **cada operación** de cada pantalla, no dicen con precisión **qué se puede y qué no** (por rol, por plan, por estado del registro) y las FAQ están todas juntas en `faq/preguntas.mdx`.

Objetivo: que un usuario nuevo pueda operar el sistema completo solo leyendo, y que soporte pueda contestar con un link.

## Decisiones

1. **Un artículo por tarea** además de la guía de cada sección (la guía pasa a ser un índice con resumen + links). Ej.: `ventas/guia.mdx` (visión general) + `ventas/nueva-venta.mdx`, `ventas/filtrar-y-buscar.mdx`, `ventas/imprimir-comprobante.mdx`, ya existentes `pago-dividido`, `canje`, `garantia`, `recargos`, `eliminar-venta` (revisarlos y completarlos, no duplicarlos).
2. **FAQ por sección**: cada `guia.mdx` termina con `## Preguntas frecuentes` (mínimo 6, formato `**¿Pregunta?**` + respuesta corta con link al artículo). `faq/preguntas.mdx` queda como las FAQ **transversales** (cuenta, plan, roles, errores comunes) y linkea a las de cada sección.
3. **Fuente de verdad = el código**, no la memoria ni este plan: antes de escribir una operación, leer el `*-client.tsx`, el `actions.ts` y `lib/db/<dominio>.ts` de la sección para saber qué botones existen, qué valida y quién puede hacerla. Si algo del manual contradice la app, gana la app.
4. **Cada artículo declara límites**: bloque `## Qué no se puede` (o `<Aviso tono="warning">`) con lo que el sistema no permite y por qué (rol, plan en solo lectura, registro ya conciliado/entregado, etc.).
5. Sin capturas inventadas: usar `<Captura alt="..." />` sin `src` (placeholder) donde una imagen ayudaría. Nunca datos de una organización real.

## Qué debe cubrir cada sección (mínimo)

Para cada ítem: **cómo se hace (pasos), qué campos pide, qué pasa después (stock, caja, cuenta corriente, notificaciones), quién puede, qué no se puede.**

- **Primeros pasos**: registro (email/Google, confirmar mail, recuperar contraseña), crear organización, invitar equipo (cupo por plan, invitación pendiente, reenviar), datos del negocio, inventario inicial (alta manual vs CSV), primera venta. Prueba gratis de 14 días y qué pasa al vencer (solo lectura: se ve todo, no se escribe, no se borra nada).
- **Dashboard**: selector de mes (`‹ Octubre de 2026 ›`, `?mes=`), qué mide cada tarjeta (Ventas del mes, **Ganancia del mes**, Margen, Tickets abiertos, Ticket promedio, Turnos hoy), **Ritmo del mes** (acumulado vs mes anterior vs ritmo ideal, línea "Hoy"), Objetivo del mes (y cómo se edita la meta en Configuración), mix de rubros, turnos, ventas recientes (click abre la venta). Diferencias por rol: vendedor ve solo sus ventas y **sin ganancia/margen/objetivo**; técnico ve sus tickets. Actualización en vivo.
- **Ventas**: Nueva venta completa (cliente existente/nuevo, ítems desde stock/servicio/otros/libre, servicios con repuestos usados, vendedor, pagos, recargos, pago dividido y «Saldar», cuenta corriente, canje), filtros (período, rango, vendedor, rubro, buscador por número/cliente/IMEI), orden, paginación, tabs Ventas/Ítems vendidos, detalle (Pagos, Rentabilidad solo admin), imprimir comprobante y garantía (venta o ítem), **eliminar venta** (admin; los 5 checkboxes y qué revierte cada uno), qué NO se puede editar una vez creada.
- **Inventario**: tabs Equipos / Repuestos / Otros; alta y edición de equipo (IMEI único, estados y qué significa cada uno), repuestos (stock mínimo, proveedor), Otros, **Recuento** (edición inline) vs **Ingreso**, historial de movimientos de stock, importar por CSV.
- **Recuentos**: qué es, cómo se hace un recuento, diferencias, cómo se ajusta el stock, historial.
- **Reparaciones**: Nuevo ticket (campos, checklist de ingreso de 22 ítems, color, clave/código), flujo de estados (`TICKET_FLOW`) y cómo avanzar, asignar técnico, agregar servicios/repuestos/ítem libre (descuento y reposición de stock), editar precio, checklist de egreso, **Ticket de ingreso / Presupuesto / Ticket de egreso** (cuándo aparece cada uno), entregar equipo y cobro (caja o cuenta corriente), catálogo de Servicios (garantía en días), filtros y pipeline.
- **Turnos**: calendario de 7 días × 09–20 h, agendar (cliente registrado o sin registrar), tipos (compra/deja/retira/cotizar), equipos vinculados y cómo cambian su estado, «Cliente llegó» y la notificación, cancelar/reprogramar, qué NO muestra (solo próximos 7 días).
- **Cajas**: cajas (moneda, medio de pago único, activar/desactivar), Nuevo movimiento, tarjetas por medio de pago como filtro, **conciliar** (monto contado, diferencia, comentario, qué se archiva), historial de conciliaciones, por qué no hay cierre diario, quién puede (admin/técnico).
- **Compras**: alta a proveedor, estados pendiente/recibida, medio de pago, compras de **canje** (se generan solas desde Ventas) y su recibo, qué pasa con stock/caja.
- **Cuentas corrientes**: cargos vs pagos, saldo, registrar pago desde la ficha, de dónde salen los cargos (ventas y tickets), qué pasa al borrar una venta fiada.
- **Clientes**: alta (fecha de nacimiento opcional y para qué sirve), ficha con historial cruzado (ventas/tickets/turnos), contadores calculados, búsqueda, deep link.
- **Difusión**: armar listas para WhatsApp, secciones, entradas por condición/categoría que se evalúan contra el stock real, copiar/pegar; qué NO hace (no envía mensajes).
- **Analíticas** (solo admin): las 6 pestañas (Ventas, Reparaciones, Finanzas, Inventario, Clientes, Turnos), selector de período, qué mide cada gráfico y sus definiciones (margen ponderado, cobrado, activo/en riesgo, etc.), "Estado actual" vs filtrado por período, por qué un dato puede aparecer como "—" o "sin cotización".
- **Configuración**: Mi cuenta, Usuarios y roles (invitar, cambiar rol, desactivar), Datos del negocio (logo: PNG/JPG/WebP ≤ 2 MB; objetivo del mes; recargos por medio de pago), Recibos (textos de garantía y de reparaciones, preview), Importar datos (formato exacto del CSV, dedupe, qué rechaza y por qué), Plan y facturación (`/plan`).
- **Herramientas**: buscador global (CommandPalette, atajos), notificaciones en tiempo real (qué eventos existen, que se pierden al recargar), reportar un problema (límite 3 por minuto).
- **Roles**: matriz **qué ve y qué puede hacer cada rol** por sección (admin / vendedor / técnico). Es la tabla más consultada: armarla leyendo `lib/nav.ts` (`navForRole`) y los `requireRole`/`requireRoleEscritura` de cada `actions.ts`.
- **Glosario**: completar con todos los términos de la app (canje, conciliación, recargo, IMEI, ticket, blue, solo lectura, objetivo, ritmo ideal, etc.).

## Formato de cada artículo

Frontmatter obligatorio (validado por `lib/ayuda.ts`): `titulo`, `resumen` (1 oración, buena para SEO), `seccion` (una de `SECCIONES_AYUDA`), `roles` (`[]` = todos; `[admin]` si es solo-admin), `orden`, `actualizado` (fecha de hoy).
Estructura: intro de 1–2 líneas → `<Paso n titulo>` por cada paso → `## Qué pasa después` → `## Qué no se puede` → `## Preguntas frecuentes` (en guías) → `## Relacionados`. Componentes disponibles sin importar: `Paso`, `Aviso` (`info` | `warning`), `Captura`, `Video`. Español rioplatense (voseo: "tocá", "elegí"), tono directo, sin jerga técnica (decir "equipo", no "registro"). Nombres de botones y pestañas **exactamente** como están en la UI (entre «»).

## Verificación

- `npx vitest run lib/ayuda.test.ts` (frontmatter válido, links internos sin romper, índice).
- `npx tsc --noEmit`.
- Levantar `npm run dev` y abrir `/ayuda`, cada `/ayuda/<seccion>` y 3 artículos nuevos: renderizan, el índice lateral funciona, el buscador los encuentra.
- Revisar que ningún link interno `/ayuda/...` apunte a un slug inexistente y que cada artículo nuevo esté en el sitemap (`app/sitemap.ts` lo toma del índice).
- Si algún texto del manual describe algo que **no existe** en la app (o al revés, algo de la app no tiene artículo), listarlo en el informe final en vez de inventarlo.

## Prompt para el agente

> Sos un redactor técnico con acceso al repo de Tekly (SaaS de gestión para negocios de venta y reparación de iPhones). Tu tarea: **completar el manual de usuario** del centro de ayuda, siguiendo `plans/017-manual-de-usuario-completo.md` (leelo entero primero) y el contexto de `plans/013-centro-de-ayuda.md` y `CLAUDE.md`.
>
> **Qué hacer**
> 1. Leé `lib/ayuda.ts`, `lib/ayuda-secciones.ts`, `components/ayuda/mdx.tsx` y 3–4 artículos existentes de `content/ayuda/` para copiar el formato exacto.
> 2. Trabajá **sección por sección**, en este orden: Ventas, Inventario, Reparaciones, Cajas, Turnos, Compras, Cuentas corrientes, Clientes, Recuentos, Dashboard, Analíticas, Difusión, Configuración, Herramientas, Roles, Primeros pasos, Glosario, FAQ.
> 3. Para cada sección: **leé el código real** (`app/(app)/<seccion>/*-client.tsx`, `actions.ts`, `lib/db/<dominio>.ts`, `lib/<dominio>.ts`, `lib/nav.ts`) y anotá cada botón, campo, validación, restricción por rol (`requireRole*`) y por plan (`requireEscritura`, solo lectura). Con eso, escribí un artículo por tarea (cómo se hace, paso a paso) y ampliá la `guia.mdx` como índice de la sección.
> 4. Cada artículo debe decir **qué se puede y qué no** (por rol, por plan, por estado del registro) y qué efectos tiene la operación en el resto del sistema (stock, caja, cuenta corriente, notificaciones, documentos imprimibles).
> 5. Cada `guia.mdx` termina con `## Preguntas frecuentes` (mínimo 6 por sección, preguntas reales que haría un dueño de local, respuestas cortas con link al artículo). `faq/preguntas.mdx` queda con las transversales y linkea a las de cada sección.
> 6. Armá en `roles/` la **matriz de permisos** por sección y rol a partir del código, no de supuestos.
> 7. Actualizá el Dashboard según el estado actual: selector de mes, tarjeta Ganancia del mes, gráfico «Ritmo del mes» (ya no existe «Tendencia de ventas» en admin) y que el buscador de la barra superior fue eliminado (el buscador global es el de la paleta de comandos).
>
> **Reglas**
> - No inventes funciones. Si no podés confirmarlo en el código, no lo escribas; anotalo en el informe final como duda.
> - Español rioplatense con voseo, tono claro y directo. Nombres de botones/pestañas exactos como en la UI, entre «».
> - Frontmatter completo y válido (`seccion` ∈ `SECCIONES_AYUDA`, `roles` correcto, `actualizado` = fecha de hoy). Slugs en minúscula con guiones.
> - Solo componentes MDX existentes (`Paso`, `Aviso`, `Captura`, `Video`). Capturas como placeholder (`<Captura alt="…" />` sin `src`); nunca datos reales.
> - No toques código de la app, migraciones ni estilos. Si el manual exige un cambio de código, no lo hagas: listalo al final.
> - No agregues dependencias ni reproductores de terceros (afectaría `/cookies`).
> - Los links internos deben apuntar a artículos que existan.
>
> **Entrega**: corré `npx vitest run lib/ayuda.test.ts` y `npx tsc --noEmit`, levantá `npm run dev` y revisá en `/ayuda` que los artículos nuevos rendericen y se encuentren con el buscador. Informe final: lista de artículos creados/modificados, discrepancias detectadas entre la app y la documentación previa, y dudas pendientes para el dueño. No hagas commit.

---

## Informe de ejecución

**Verificación**
- `npx vitest run` → 402 tests OK (incluye `lib/ayuda.test.ts`, ajustado: el «siguiente» de `ventas/guia` pasó de `pago-dividido` a `nueva-venta`).
- `npx tsc --noEmit` → sin errores.
- Los 73 cuerpos MDX compilan con `@mdx-js/mdx`.
- Todos los links `/ayuda/*` resuelven (script de comprobación).
- `content/ayuda` **73 artículos** (43 nuevos + 22 reescritos/ampliados; total tocado 64).

**Bloqueo de render (preexistente, ajeno al contenido)**
En este entorno, **todas** las páginas `/ayuda/<seccion>/<slug>` (también las que ya existían, ej. `primeros-pasos/primera-venta`) devuelven **500** con `Error: A React Element from an older version of React was rendered` desde `next-mdx-remote@6.0.0` con React 18.3.1 / Next 15.5.27. `/ayuda` (home) sí responde 200. No es causado por el contenido (los artículos viejos fallan igual y los MDX compilan). Requiere decisión de código fuera del alcance de este plan (alinear `next-mdx-remote` con React 18 o subir React). **No se tocó código de la app.**

**Discrepancias app ↔ documentación previa (corregidas en el manual)**
- **Turnos**: el manual viejo describía «Cliente llegó» y el evento `appointment_arrived`, **eliminados** del código (migración `20260917000000`). Tampoco existe **reprogramar** ni estado de asistencia. Los turnos nacen **«Confirmado»** (no «Pendiente»). Reescrito.
- **Dashboard**: el texto previo hablaba de «tendencia de ventas con línea de ganancia», «objetivo» y «pendientes del taller». El admin hoy ve 6 métricas (incluye **Ganancia del mes**) y el gráfico **«Ritmo del mes»**; el selector de mes es `?mes=`. Reescrito.
- **Recuentos**: no hay edición inline; es un **modal** de conteo. Documentado.
- **Registro**: el plan pedía cubrir "email/Google"; **no hay login con Google** (solo email/contraseña + antirobots). Se documentó lo real.
- **Invitaciones**: no existe «invitación pendiente» ni «reenviar»; al invitar el usuario queda activo y ocupa cupo. Documentado.
- **`lib/difusion.ts`** y «Cliente llegó» en `CLAUDE.md`/`AGENTS.md` están desactualizados (no se tocó el CLAUDE.md, es fuera de alcance).
- **Presupuesto**: `ReciboChecklistComparado` está exportado pero **no se usa**; el Presupuesto implementado no imprime el comparado ingreso/egreso.

**Dudas para el dueño**
- ¿Se agrega inicio de sesión con Google o el acceso queda solo con email/contraseña?
- ¿Se implementa reprogramar/cancelar con reversión de reservas de stock en Turnos?
- ~~¿Se corrige la versión de `next-mdx-remote`/React para que las páginas de ayuda rendericen?~~ — resuelto con `transpilePackages: ["next-mdx-remote"]` (no hizo falta tocar versiones).
- ¿Se incorpora el checklist comparado al documento Presupuesto?
- ¿Se agrega reenvío de invitación y estado «pendiente»?
