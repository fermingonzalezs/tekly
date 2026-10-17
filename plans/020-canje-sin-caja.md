# 020 — Canje sin caja: «Mercadería» es medio de pago, no una caja

**Status:** EJECUTADO (2026-10-17) — código completo. La limpieza de datos (Parte D) se aplica recién cuando el código esté desplegado (ver la nota de la Parte D).
**Scope:** Ventas (Nueva venta, detalle, eliminar), Cajas (medios, tarjetas), inventario (alta automática del equipo recibido), demo, ayuda y `CLAUDE.md`. Sin tabla nueva.

## Problema

Hoy un pago con medio `canje` («Mercadería») pide elegir una **caja** de ese medio y genera un `ingreso` en `movimientos_caja`. Pero el equipo recibido no es dinero: es una compra de mercadería pagada con parte de la venta. Consecuencias: aparece una caja «CANJE» en Cajas/Conciliación/Finanzas que nadie puede contar físicamente, y el equipo recibido **no entra al inventario** (solo se crea una `Compra` de canje con su recibo): el valor queda «flotando» en una caja y el stock real no lo refleja. El plan 019 (Patrimonio) necesita que esto esté bien para no contar mal ni doble.

## Decisiones (ya tomadas con el dueño)

1. El canje **sigue siendo un medio de pago de la venta** (se elige en Nueva venta, suma al total cobrado, se ve en el detalle y en el comprobante), pero **no es una caja** y **no genera movimiento de caja**. No aparece en Cajas, Conciliación, Finanzas ni en «Ingresos por medio de pago» de Analíticas (no entró plata).
2. El equipo recibido **entra solo al inventario** al confirmar la venta: un celular en estado `en_revision`, `costoUsd` = valor acordado del canje, `precioUsd` = 0 (se completa al revisarlo), con los datos de `CanjeEquipo` (modelo, marca, IMEI). La `Compra` de canje (recibo firmable con checklist) se sigue generando, ahora enlazada al celular creado.
3. La caja «CANJE» existente se retira (Parte D).

## Parte A — Ventas (`lib/db/ventas.ts`, `lib/ventas.ts`, `app/(app)/ventas/*`, `lib/demo/*`)

- **Nueva venta** (`ventas-client.tsx`): el pago con medio «Mercadería» **no muestra el selector de caja** ni exige `cajaId`; `Pago.caja` queda fijo en `"usd"` (el valor se carga en USD, ya es así). Se mantiene `CanjeModal` (celular recibido + checklist + aclaraciones) y la validación «Falta cargar el equipo del canje» (`lib/ventas.ts`). `cajasDeMedio("canje")` ya no debe contar para decidir si el medio está disponible: el medio «Mercadería» se ofrece siempre (salvo `modoDemo`, que lo sigue ocultando).
- **`createVenta`** (`lib/db/ventas.ts`): para `pago.medio === "canje"`: **no** insertar en `movimientos_caja`; crear la `Compra` de canje como hoy y además crear el **celular** (`createCelular`, estado `en_revision`, mismas reglas de movimiento de stock «ingreso» que el alta manual, `usuarioNombre` real). Guardar en el pago `compraId` y `celularId`. Si el **IMEI ya existe** en la organización (unique `organization_id, imei`): no duplicar ni abortar la venta — crear el celular **sin IMEI** y dejar la aclaración «IMEI repetido: <imei>, revisar» en `notas`/aclaraciones de la compra; avisarlo en el mensaje de éxito. Mantener la compensación a mitad de camino (`deleteVenta` con todo en `true` borra también el celular recién creado).
- **`Pago`** (`lib/types.ts`): `celularId?: string` nuevo (opcional, ventas viejas no lo tienen). `cajaId` queda opcional también para `canje`.
- **`deleteVenta`**: el checkbox «Eliminar también la compra de canje generada» pasa a cubrir **compra + celular de canje**, con una regla de seguridad: si el celular ya **no está en `en_revision`/`disponible`** (se vendió, reservó o extravió) **no se borra**: se deja y se avisa («El celular recibido en canje ya se movió: se conservó en inventario»). Sin movimiento de caja que borrar para el pago canje: el checkbox «borrar movimientos de caja» solo aplica si la venta tiene pagos no-canje con movimiento. Ventas viejas (con `cajaId` de la caja CANJE y movimiento) deben seguir pudiendo eliminarse sin romper.
- **Detalle de venta**: la fila del pago canje muestra el chip «Mercadería», el equipo y el link «Ver compra de canje»; **sin** nombre de caja. Si hay `celularId`, link «Ver celular» (`/inventario?tab=celulares&q=<imei>`).
- **Demo** (`lib/demo/operaciones.ts`): sin cambios funcionales (el canje ya está oculto en demo); solo asegurar que compila con los tipos nuevos.

## Parte B — Cajas

- `lib/status.ts`: sacar `"canje"` de `MEDIOS_CAJA` (es la fuente única de los selectores de caja y de Turnos). `MEDIOS_VENTA` ya lo suma explícito: debe seguir teniendo los 7 medios de venta (`MEDIOS_CAJA` + `cuenta_corriente` + `canje`), cuidando que **Configuración → recargos por medio** siga ofreciendo «Mercadería» si hoy lo ofrece. `medioPago` (label/tone/emoji) conserva `canje`.
- `cajas-client.tsx`: el selector «Medio de pago» de `CajaDialog` ya no ofrece «Mercadería»; `STAT_MEDIOS` deja de filtrar `canje` porque ya no está (limpiar el comentario/`filter`).
- Cajas existentes con medio `canje` (legado) siguen leyéndose sin romper hasta que se aplique la Parte D (no crashear por un medio que ya no está en la lista; mostrarlas como cualquier otra).
- `lib/cajas.ts`, Conciliación y Analíticas Finanzas: revisar que ninguna asuma `canje` como medio de caja; actualizar tests de `totalPorMedio`/`MEDIOS_CAJA` que lo incluyan.

## Parte C — Compras, ayuda y docs

- **Compras**: la compra `origen: "canje"` conserva su detalle y recibo; agregar el link al celular creado si existe `celularId` en el pago de la venta de origen. «Imprimir recibo de canje» no cambia.
- **Ayuda** (`content/ayuda/ventas/canje.mdx`, `cajas/guia.mdx`, `ventas/pago-dividido.mdx`, `ventas/eliminar-venta.mdx`, `inventario/guia.mdx`, `faq`, `glosario`): el canje ya no usa caja; el equipo aparece solo en Inventario como «En revisión»; qué pasa si el IMEI está repetido; qué pasa al eliminar la venta. `actualizado: <hoy>`.
- **`CLAUDE.md`**: actualizar «Medios de pago» (`canje` ya no es medio de caja), la nota de Ventas (canje: sin movimiento de caja; crea celular + compra), la de Cajas y la de Compras; sacar «🪙 canje» de las tarjetas de Cajas si figura. Agregar fila a `plans/README.md`.
- **Plan 019**: al terminar este plan, borrar de `armarPatrimonio` la excepción de caja `canje` (memo `canjeEnCaja`).

## Parte D — Datos existentes (producción) — SE APLICA AL DESPLEGAR

Estado relevado el 2026-10-17 (proyecto `tekly`, `xdfdrzxrmfpnezyeeaeq`): una sola caja de medio `canje` («CANJE», USD, org UPDATE TECH), con **1 movimiento** (ingreso USD 210, «Venta a Valentina López», `venta_id` seed, 2026-09-13, sin conciliar); **1 venta** con un pago `canje` apuntando a esa caja; **0 compras de canje**; **0 conciliaciones** con esa caja. Migración propuesta (revisar antes de aplicar, es un borrado de un movimiento financiero):

```sql
-- 1) Los pagos canje dejan de apuntar a la caja
update public.ventas v
set pagos = (
  select coalesce(jsonb_agg(
           case when p->>'medio' = 'canje' then (p - 'cajaId') else p end), '[]'::jsonb)
  from jsonb_array_elements(v.pagos) p)
where exists (select 1 from jsonb_array_elements(v.pagos) p where p->>'medio' = 'canje');
-- 2) Fuera el ingreso fantasma y la caja
delete from public.movimientos_caja
where caja_id in (select id from public.cajas where medio_pago = 'canje');
delete from public.cajas where medio_pago = 'canje';
```
Antes de ejecutar: confirmar con el dueño de UPDATE TECH que el movimiento de USD 210 es dato de prueba (el `venta_id` tiene forma de seed) y que no hay conciliación pendiente con esa caja. **Orden de despliegue:** primero el código nuevo (que tolera una caja `canje` legada), después esta migración. Aplicarla antes dejaría la app vieja sin la caja que sigue pidiendo. Guardarla en `supabase/migrations/` y aplicarla por MCP (`apply_migration`); correr `get_advisors` security después.

## Verificación

- `npx tsc --noEmit` y `npx vitest run` verdes (actualizar los tests de `MEDIOS_CAJA`/`totalPorMedio`; agregar tests puros: venta con pago canje no genera movimiento de caja, `categoriaDe`/validación de «Falta cargar el equipo del canje», `deleteVenta` conserva un celular de canje ya vendido).
- Con sesión real: Nueva venta con pago dividido (efectivo + Mercadería): el pago canje no pide caja; al confirmar, el celular aparece en Inventario → Celulares como «En revisión» con el costo del canje, hay Compra de canje con recibo, **no** hay movimiento de caja por el canje, la caja del pago en efectivo sí recibe el suyo. Repetir con un IMEI ya existente (se crea sin IMEI y avisa). Eliminar esa venta con y sin el checkbox; con el celular ya vendido (no se borra). Abrir la venta vieja de Valentina López antes y después de la Parte D.
- Cajas: no se puede crear una caja con medio «Mercadería»; Conciliación y Finanzas no muestran canje.
- Rol vendedor: puede vender con canje (crea celular: requiere permiso de escritura en inventario — verificar que la RLS de `celulares` insert lo permita para vendedor, como el alta de venta ya permite marcar equipos vendidos).
- Informe final: decisiones cambiadas, casos borde de IMEI, y si hubo que tocar algo fuera de lo listado.
