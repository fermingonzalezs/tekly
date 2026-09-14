-- Para que "Demografía de clientes · edad" deje de ser mock: sin esto no
-- hay ningún dato de edad en ningún lado. Opcional -- clientes cargados sin
-- este campo simplemente quedan fuera del cálculo de demografía.
alter table public.clientes add column fecha_nacimiento date;
