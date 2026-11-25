# Plans

Planes de implementación autocontenidos, pensados para que un agente los
ejecute siguiendo el formato de cada archivo (Status/Scope/Contexto/Pasos/
Verificación).

| # | Title | Status |
|---|---|---|
| [007](007-ventas-rediseno.md) | Ventas: rediseño de lista/detalle/Nueva venta + paginación en server | HECHO en código — falta verificación manual con datos |
| [011](011-modales-vidrio.md) | Modales: pasar todo el sistema al estilo vidrio | HECHO en código — falta verificación visual (`/qa/dialog` + modales con sesión) |
| [012](012-legales-cookies.md) | Legales: términos, privacidad y cookies | HECHO como borrador — falta completar datos de la empresa y revisión de un abogado |
| [013](013-centro-de-ayuda.md) | Manual de usuario y tutoriales (centro de ayuda) | HECHO en código — falta contenido/capturas del dueño |
| [014](014-demo-sin-cuenta.md) | Demo sin cuenta: Dashboard + Ventas en el navegador (sin BD) | HECHO y verificado en local — falta desplegar a producción |
| [017](017-manual-de-usuario-completo.md) | Manual de usuario completo: operaciones, límites y FAQ por sección | PENDIENTE — prompt listo para otro agente |
| [018](018-celulares-y-notebooks.md) | «Equipos» → «Celulares» + categoría Notebooks (rename completo y ventas) | HECHO en código — falta verificación manual con datos |
| [019](019-patrimonio.md) | Estado de situación patrimonial (caja + créditos + inventario − saldos a favor) | HECHO (fases 1 y 2) — falta verificación manual con sesión admin |
| [020](020-canje-sin-caja.md) | Canje sin caja: medio de pago que ingresa el equipo al inventario | HECHO en código — falta verificación manual y limpieza de datos (Parte D) al desplegar |
| [021](021-modales-formularios-centrados.md) | Modales de formulario: todo centrado menos las casillas, 3 casillas por fila | HECHO en código — falta verificación visual (`/qa/dialog` + cada modal con sesión) |
| [022](022-resumen-mensual.md) | Resumen mensual guardado (pg_cron + tabla + pantalla/PDF) | HECHO en código y migraciones aplicadas — falta `CRON_SECRET` en producción y verificación con sesión admin |
| [023](023-agenda-turnos.md) | Turnos → Agenda estilo sistema-update (Día/Semana/Mes, próximos, estados atendido/no vino) | HECHO en código — falta aplicar la migración `20261124120000_turnos_agenda` (Supabase por autorizar) y verificar en navegador |
| [024](024-variantes-celulares.md) | Celulares: grupo › variante › unidad (estilo sistema-update) | HECHO en código — falta aplicar la migración y verificar en el navegador |
| [025](025-compras-ingresos.md) | Compras / Ingresos: toda entrada de stock por compra, con IA (texto, fotos/PDF, QR) y variantes | Fase 1 HECHA en código, migración aplicada — falta verificar en el navegador; fases 2–4 pendientes |
| [026](026-descuentos-regalos-venta.md) | Ventas: diferencia sobre el total (descuento/recargo) y venta de regalo | HECHO en código (revisado 25/11), migraciones aplicadas — falta verificar en el navegador |
| [027](027-recargo-por-caja.md) | Recargo por caja en vez de por medio de pago (Configuración → Cajas) | HECHO en código — migración `20261125210000_cajas_recargo` aplicada; falta verificar en el navegador |
| [028](028-pedidos-items-sena.md) | Agenda → Pedidos: varios productos con precio, seña y saldo por abonar | HECHO en código — falta aplicar la migración `20261126100000_pedidos_items_sena` y verificar en el navegador |
| [029](029-invitar-sin-instagram-roles-multiples.md) | Configuración: invitar sin Instagram + varios roles por usuario (ej. Vendedor y Técnico) | HECHO en código — migración `20261126110000_profiles_roles_multiples` aplicada (25/11); falta verificar en el navegador |
