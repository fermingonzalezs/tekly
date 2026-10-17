-- Notebooks: condición (nuevo / usado) y, para las usadas, estado de la batería.
alter table public.notebooks
  add column condicion text not null default 'nuevo'
    check (condicion in ('nuevo', 'usado')),
  add column bateria integer
    check (bateria is null or bateria between 0 and 100);

-- La batería solo se informa en las usadas.
alter table public.notebooks
  add constraint notebooks_bateria_solo_usadas
    check (condicion = 'usado' or bateria is null);
