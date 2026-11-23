-- "Leer con IA" pasa a una lectura por tipo de carga (sin renovación): se
-- guarda el resultado para poder retomarlo (editar y confirmar) si se recarga
-- la página antes de importar.
alter table public.ia_lecturas
  add column filas_resultado jsonb not null default '[]'::jsonb;

create index ia_lecturas_org_entidad_idx on public.ia_lecturas (organization_id, entidad, created_at desc);
