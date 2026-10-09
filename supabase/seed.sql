-- Datos de arranque SOLO para el entorno local (se cargan con `supabase db reset`).
-- Activa el envío de push desde la base de datos local hacia la función enviar-push.
-- En un proyecto remoto estos dos ajustes se insertan a mano, con su URL y un secreto
-- propio que coincida con la variable PUSH_SECRETO de la función.
insert into private.ajustes (clave, valor) values
  ('push_url', 'http://kong:8000/functions/v1/enviar-push'),
  ('push_secreto', 'secreto-solo-para-desarrollo-local')
on conflict (clave) do update set valor = excluded.valor;
