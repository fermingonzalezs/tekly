-- Cron mensual del resumen. Corre el día 1 a las 04:30 UTC (01:30 hora
-- Argentina) y le pega a la ruta /api/cron/resumen-mensual de la app, que
-- recorre las organizaciones y guarda el resumen del mes anterior. La lógica
-- vive en TypeScript (misma que Analíticas): la base solo dispara el pedido.
--
-- Los secretos NO se versionan: se cargan una vez en Vault (ver CLAUDE.md,
-- «Resumen mensual»):
--   select vault.create_secret('<url de la app, sin barra final>', 'cron_app_url');
--   select vault.create_secret('<mismo valor que CRON_SECRET de la app>', 'cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'resumen-mensual',
  '30 4 1 * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_app_url')
           || '/api/cron/resumen-mensual',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $job$
);
