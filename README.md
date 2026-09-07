# TallerCRM — MVP visual

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

- **Dashboard**: métricas, tendencia de ventas (SVG), panel de resumen con
  dona, ventas recientes. Datos mock.
- Resto del sidebar: placeholders navegables.
