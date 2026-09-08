# Tekly — MVP visual

MVP puramente visual (sin backend, sin DB, sin auth). Usuario logueado fijo
("Fermín G. · Admin"), datos mock en `lib/mock-data.ts`.

```bash
npm install
npm run dev        # http://localhost:3100
```

## Notificaciones en tiempo real

`lib/realtime.ts` es el pub/sub de eventos entre sesiones:

- **Sin credenciales** → `BroadcastChannel` nativo. Cross-tab en el mismo
  browser. Abrí el dashboard en **dos pestañas**, dispará un evento en una y
  el toast aparece en la otra.
- **Con credenciales** (`.env.local` desde `.env.local.example`) → Supabase
  Realtime **Broadcast** (canal `crm-events`, evento `app`, `self: false`).
  Cross-device. No crea tablas.

El emisor nunca ve su propio toast (son "acciones de otros usuarios").

Botón flotante **Simular** (abajo a la izquierda): dispara eventos fake
(venta confirmada, ticket listo, presupuesto aprobado, cliente llegó, stock
bajo) con datos randomizados.

## Estado

Todo con datos mock en `lib/mock-data.ts` + estado local de React. Sin
persistencia: al refrescar se vuelve al set inicial.

- **Dashboard**: métricas, tendencia de ventas (SVG), panel de resumen con
  dona, ventas recientes.
- **Ventas**: historial con filtro por vendedor / tipo / fecha, KPIs, alta de
  venta con múltiples ítems → dispara toast «venta confirmada».
- **Reparaciones**: 2 tabs — Tickets (pipeline, filtros, detalle con servicios y
  stepper, avanzar estado / aprobar / marcar listo → toasts, alta de ticket) y
  Servicios (catálogo editable: nombre, precio, garantía, activo).
- **Turnos**: calendario de los próximos 7 días (09–20 h), color por motivo
  (compra / deja / retira / cotizar); «cliente llegó» → toast; agendar en un
  hueco.
- **Inventario**: 3 tabs — equipos para venta, repuestos y otros (iPad, AirPods,
  etc.). Recuento inline e ingreso de stock (cantidad + precio compra).
- **Clientes**: tabla con búsqueda, ficha con historial, alta de cliente.
- **Cajas**: caja USD y caja ARS separadas (la ARS guarda pesos) + total
  consolidado en ARS a la cotización; movimientos del día e historial completo,
  totales por medio de pago, cierres previos.
- **Analíticas**: ventas por mes, margen por tipo, tiempo por falla,
  rendimiento por técnico.
- **Configuración**: usuarios y roles, cotización USD, plantillas de WhatsApp,
  datos del negocio.

Componentes compartidos nuevos: `ui/badge`, `ui/dialog`, `ui/tabs`,
`ui/field`. Config de estados y tonos en `lib/status.ts`, tipos en
`lib/types.ts`.
