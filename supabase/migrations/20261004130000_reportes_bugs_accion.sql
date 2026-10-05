-- "Reportar un problema" ahora también guarda qué estaba haciendo el usuario
-- (acción) además de la descripción libre y la ruta (sección) -- esta
-- columna es nueva, nullable porque los reportes viejos no la tienen.

alter table public.reportes_bugs add column accion text;
