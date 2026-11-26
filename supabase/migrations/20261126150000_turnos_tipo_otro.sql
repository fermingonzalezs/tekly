-- Motivo de turno «Otro» (cualquier cosa que no sea compra / deja / retira /
-- cotizar). Se usa con el comentario del turno para aclarar el motivo.
alter table public.turnos drop constraint turnos_tipo_check;
alter table public.turnos
  add constraint turnos_tipo_check
  check (tipo in ('compra', 'deja', 'retira', 'cotizar', 'otro'));
