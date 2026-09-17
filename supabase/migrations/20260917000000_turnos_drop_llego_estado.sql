-- Se eliminó la opción "Cliente llegó" de Turnos (botón + notificación
-- appointment_arrived) -- "llego" deja de ser un estado válido de turno.
-- Sin filas existentes en ese estado al momento de esta migración.
alter table public.turnos drop constraint turnos_estado_check;
alter table public.turnos add constraint turnos_estado_check
  check (estado in ('pendiente', 'confirmado', 'cancelado'));
