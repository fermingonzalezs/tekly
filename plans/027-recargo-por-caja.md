# 027 — Recargo por caja (en vez de por medio de pago)

**Status:** HECHO en código (2026-11-25). Falta verificar en el navegador con sesión (crear/editar una caja con recargo y verlo en el cobro). **Migración ya aplicada** (`20261125210000_cajas_recargo.sql`): existe `cajas.recargo_pct numeric not null default 0` (0–100), completado con el % que cada organización tenía para el medio de la caja. **No hay que aplicar nada en la base.**

**Scope:** el recargo (% que se suma a lo que se cobra) se configura **en cada caja** (Cajas → crear/editar caja) y se lee de la caja elegida en cada pago. Hoy está en Configuración → «Recargo por medio de pago» (`organizations.recargos_medios_pago`, jsonb `{ medio: % }`) y no distingue dos cajas del mismo medio (Visa 10 % vs Naranja 15 %, MercadoPago).
**Fuera de alcance:** recargos por cuotas, recargo en compras (egresos), recalcular pagos ya guardados.

Leer antes: `CLAUDE.md` (secciones «Cajas», «Ventas» —párrafo de `Negocio.recargosMediosPago` y del pago—, «Moneda», «`Dialog`», «Testing») y este plan entero.

## Decisiones (no re-decidir)

1. **Fuente del recargo = la caja.** Todo pago que va a una caja usa `caja.recargoPct`. El snapshot sigue igual: `Pago.recargoPct` se guarda en el pago al confirmar (las ventas viejas no cambian).
2. **Cuenta corriente** no es una caja: su recargo **sigue** en `organizations.recargos_medios_pago.cuenta_corriente`. En Configuración, la tarjeta «Recargo por medio de pago» queda **solo con Cuenta corriente** (renombrarla «Recargo de cuenta corriente») y un texto que diga que el resto se configura en cada caja, con link a `/cajas?tab=cajas`.
3. `recargos_medios_pago` **no se borra** de la base ni del tipo `Negocio`: queda para `cuenta_corriente`. Los demás keys quedan muertos (no leerlos más en ningún lado).
4. «Mercadería» (canje) no lleva recargo (no es caja, ya es así).
5. Nada de server confiando en el cliente para el recargo: `createVenta` y el cobro de tickets (`lib/db/reparaciones.ts`, ~línea 157, `montoConRecargo(pago.montoUsd, pago.recargoPct)`) **toman el % de la caja en el server** (`cajas.recargo_pct` por `cajaId`; para `cuenta_corriente`, de `organizations`) y lo guardan en `Pago.recargoPct`, ignorando el que mande el cliente.

## Cambios

### Tipos y datos
- `lib/types.ts`: `Caja.recargoPct: number`.
- `lib/db/cajas.ts`: `CAJA_COLS` + `recargo_pct`; `toCaja` lo mapea (`Number(...)`); `CajaInput.recargoPct`; `saveCaja` lo escribe. Validar 0–100 (lógica pura en `lib/cajas.ts`, ej. `errorRecargo(pct)`, con test en `lib/cajas.test.ts`).
- `app/(app)/cajas/actions.ts` (`saveCajaAction`): pasa `recargoPct` y valida con la función pura.
- `lib/demo/seed.ts`: cajas de la demo con `recargoPct` (0 en todas salvo, por ejemplo, una de tarjeta con 10, para que se vea).

### Cajas (`app/(app)/cajas/cajas-client.tsx`, `CajaDialog`)
- Campo **«Recargo %»** junto a Moneda y Medio (`GrillaCampos`, input numérico centrado, sin flechas; vacío = 0). Texto chico: «Se suma a lo que se cobra en esta caja (ej. comisión de tarjeta)».
- En la tabla de cajas (pestaña Cajas), columna **Recargo** (`10 %` o «—»).

### Nueva venta (`app/(app)/ventas/ventas-client.tsx`)
- `destinoPago` / `medioAPago` (~líneas 2385–2425): `recargoPct: caja?.recargoPct || undefined` en vez de `negocio.recargosMediosPago[...]`. `cuenta_corriente` sigue con `negocio.recargosMediosPago.cuenta_corriente`.
- Al cambiar la **caja** de un pago (select de caja), actualizar también `recargoPct` (hoy solo cambia `cajaId`/`caja`).
- El aviso «+X% → cobra U$…» ya existe: que siga funcionando con el % de la caja.
- Server (`lib/db/ventas.ts` `createVenta`): resolver el % por `cajaId` (un select de `cajas` con los ids de los pagos) y pisar `recargoPct` de cada pago antes de calcular `montoArs` y los movimientos.

### Reparaciones (`app/(app)/reparaciones/reparaciones-client.tsx`, cobro/entrega ~1785–1830)
- Mismo cambio que Ventas (`destinoPago`/`medioAPago` + cambio de caja). Server: `lib/db/reparaciones.ts` toma el % de la caja.

### Agenda (`components/agenda/agendar-dialog.tsx` ~línea 413)
- Los pagos de un turno van por **medio** (sin caja). Usar el recargo de la **primera caja activa de ese medio** (mismo criterio con que Nueva venta auto-elige la caja), o 0 si no hay. Es solo informativo (no mueve caja).

### Configuración (`app/(app)/configuracion/configuracion-client.tsx` ~690–730)
- Dejar solo la fila de **Cuenta corriente** (Decisión 2) + texto con link a Cajas. `updateNegocio` sigue guardando `recargos_medios_pago` (solo con `cuenta_corriente`; no borrar los otros keys que ya estén, simplemente no editarlos).

### Ayuda y docs
- `content/ayuda/cajas/administrar-cajas.mdx` (campo Recargo), `content/ayuda/ventas/recargos.mdx` (ahora es por caja), `content/ayuda/configuracion/*` si menciona los recargos. Fecha `actualizado`.
- `CLAUDE.md`: sección «Cajas» (`Caja.recargoPct`) y el párrafo de Ventas que habla de `Negocio.recargosMediosPago` (ahora solo cuenta corriente; el resto es `caja.recargoPct`).
- `plans/README.md` fila 027 + Status de este archivo.

## Verificación
1. `npx tsc --noEmit` y `npx vitest run` en verde.
2. Demo `/demo/ventas` (no necesita sesión): una venta con la caja que tiene recargo muestra «+10 % → cobra …»; cambiar de caja cambia el %. Sin errores de hidratación en consola.
3. Con sesión (pedirle al usuario que se loguee en el panel; **no tipear contraseñas**): crear/editar una caja con recargo, ver la columna en Cajas, y que Configuración muestre solo Cuenta corriente. Crear datos reales solo con OK del usuario.
4. `graphify update .` si está instalado.

## Cuidado
- `ventas-client.tsx`, `lib/ventas.ts` y `lib/db/ventas.ts` los editan otras sesiones: releer justo antes de cada edición, cambios chicos.
- No commitear sin que el usuario lo pida. No `git stash` ni `checkout`.
- `fmtUsd` para montos, nunca a mano.
