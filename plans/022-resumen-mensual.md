# 022 — Resumen mensual guardado (pg_cron)

**Status:** HECHO en código y migraciones aplicadas — falta (1) cargar `CRON_SECRET` en el entorno de producción, (2) desplegar la ruta, y (3) verificación visual con sesión admin.
**Scope:** tabla `resumenes_mensuales`, cron mensual, ruta `/api/cron/resumen-mensual`, pantalla `/resumenes` (+ detalle con PDF), lógica pura `lib/resumen-mensual.ts`.

## Decisiones

1. **Híbrido**: los flujos (ventas, reparaciones, compras, caja) salen de las fechas del mes y se pueden calcular siempre; las **fotos** (inventario, saldos, patrimonio) no se pueden reconstruir, así que se guardan al cierre. Un resumen se **congela** porque un admin puede borrar una venta.
2. **Cron = solo un disparador.** `pg_cron` + `pg_net` llaman a la ruta; la lógica vive en TypeScript y reusa los `resumen*` de Analíticas (mismos números que la pantalla). Se descartó duplicar el cálculo en SQL.
3. **Sin sesión de usuario**: `lib/auth/scope.ts` (`conOrganizacion`) hace que `createServerClient()` devuelva un cliente de **service role de solo lectura acotado a la organización** (cada `select` agrega `organization_id = <org>`; escrituras/`rpc` tiran). Así se reusan todas las `list*` de `lib/db`, con el aislamiento forzado en un solo lugar (con service role no corre la RLS). Tiene tests.
4. **Escritura** siempre por service role con `organization_id` explícito; la tabla no tiene policies de escritura para `authenticated`. Lectura: solo admin de la org.
5. **Un resumen congelado (`foto_fiable`) nunca se pisa** con uno que no lo es (regenerar a mano un mes viejo perdería la foto del cierre).
6. **Cotización**: la base no puede consultar dolarapi; se usa la de `getDolarServer()` al generar. Si cayó al valor de respaldo (inventado), el resumen guarda `cotizacion: null` y **no arma el patrimonio**.

## Piezas

- `supabase/migrations/20261018100000_resumenes_mensuales.sql` (tabla, RLS, grants) y `20261018110000_resumenes_mensuales_cron.sql` (extensiones + `cron.schedule('resumen-mensual', '30 4 1 * *')` = 01:30 hora Argentina del día 1).
- **Secretos (no versionados)**, en Vault: `cron_app_url` (`https://sistema.tekly.tech`) y `cron_secret` (generado en la base). La app necesita `CRON_SECRET` con el **mismo valor**: `select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'`.
- `lib/resumen-mensual.ts` (+ test): períodos, `armarResumenMensual`, `RESUMEN_VERSION` (shape de `datos`; subirla si cambia).
- `lib/db/resumenes.ts`: `armarDatos`, `generarResumenesDeTodasLasOrganizaciones` (cron), `generarResumenPropio` (botón), `listResumenes`, `getResumen`.
- `app/api/cron/resumen-mensual/route.ts` (Bearer con `timingSafeEqual`; sin `CRON_SECRET` queda cerrada; idempotente; body opcional `{ "periodo": "YYYY-MM" }`). `/api/cron` es público en `middleware.ts`.
- `app/(app)/resumenes/`: lista + «Generar resumen de un mes», detalle `[periodo]` con tarjetas y `Imprimir / PDF` (reusa `ReciboImprimir`; `ReciboPagina.sinCliente`).
- Nav: Finanzas → Resúmenes (solo admin). Ayuda: `content/ayuda/resumenes/guia.mdx`.

## Pendiente / ideas

- Disparar a mano un mes: `curl -X POST <app>/api/cron/resumen-mensual -H "Authorization: Bearer $CRON_SECRET" -d '{"periodo":"2026-09"}'`.
- Ver si corrió: `select * from cron.job_run_details order by start_time desc limit 5;` y `select * from net._http_response order by created desc limit 5;`.
- Escala: trae las listas completas por organización (igual que Patrimonio). Si una org crece mucho, pasar a consultas por rango.
- Gráfico de evolución mensual en la lista y comparación entre dos meses.
