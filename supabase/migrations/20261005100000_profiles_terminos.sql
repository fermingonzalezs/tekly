-- Aceptación de Términos y Política de Privacidad (plan 012): versión del texto
-- aceptado y cuándo. Las escribe el signup / la pantalla de aceptación por
-- service role (profiles no tiene policy de update para authenticated).
alter table public.profiles
  add column if not exists terminos_version text,
  add column if not exists terminos_aceptados_at timestamptz;
