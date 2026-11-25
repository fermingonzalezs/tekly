-- Plan 027: el recargo pasa de «por medio de pago» (Configuración,
-- `organizations.recargos_medios_pago`) a **cada caja**: dos cajas del mismo
-- medio (Visa / Naranja, MercadoPago…) pueden tener comisiones distintas.
--
-- `cajas.recargo_pct`: % que se suma a lo que se cobra en esa caja (mismo
-- significado que `Pago.recargoPct`). Se completa con el % que la
-- organización tenía para el medio de la caja, así no se pierde nada.
-- `recargos_medios_pago` NO se borra: «cuenta_corriente» (que no es una
-- caja) sigue saliendo de ahí, y los pagos viejos guardan su propio
-- `recargoPct` como snapshot.

alter table public.cajas
  add column recargo_pct numeric not null default 0
    check (recargo_pct >= 0 and recargo_pct <= 100);

update public.cajas c
set recargo_pct = coalesce((o.recargos_medios_pago ->> c.medio_pago)::numeric, 0)
from public.organizations o
where o.id = c.organization_id
  and o.recargos_medios_pago ? c.medio_pago;
