begin;
select plan(16);

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');
select tests.crear_usuario('carla');

insert into public.amistades (solicitante_id, destinatario_id, estado) values
  (tests.id_de('ana'), tests.id_de('beto'), 'aceptada');

create temp table contexto (clave text primary key, valor text);
grant all on contexto to authenticated;

select tests.entrar_como('ana');
insert into contexto
select 'chat', public.abrir_conversacion_directa(tests.id_de('beto'))::text;
insert into contexto
select 'nota', tests.id_de('ana')::text || '/' || valor || '/uno.m4a' from contexto where clave = 'chat';
insert into contexto
select 'otra', tests.id_de('ana')::text || '/' || valor || '/dos.m4a' from contexto where clave = 'chat';

-- ----------------------------------------------------------------- Subir
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('notas-voz', (select valor from contexto where clave = 'nota'), tests.id_de('ana')) $$,
  'Ana sube una nota de voz a su conversación con Beto'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('notas-voz', tests.id_de('beto')::text || '/' || (select valor from contexto where clave = 'chat') || '/x.m4a', tests.id_de('ana')) $$,
  '42501',
  null,
  'Ana no puede subir a la carpeta de Beto'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('notas-voz', tests.id_de('ana')::text || '/no-es-un-id/x.m4a', tests.id_de('ana')) $$,
  '42501',
  null,
  'Una ruta mal formada se rechaza'
);

select tests.entrar_como('carla');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('notas-voz', tests.id_de('carla')::text || '/' || (select valor from contexto where clave = 'chat') || '/x.m4a', tests.id_de('carla')) $$,
  '42501',
  null,
  'Carla no puede subir notas a un chat ajeno'
);

-- ---------------------------------------------------------------- Enviar
select tests.entrar_como('ana');
select throws_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, audio_ruta, audio_duracion_ms)
     values ((select valor::uuid from contexto where clave = 'chat'), tests.id_de('ana'),
             (select valor from contexto where clave = 'otra'), 4000) $$,
  '23514',
  null,
  'No se puede enviar una nota que no se ha subido'
);
select throws_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, audio_ruta, audio_duracion_ms)
     values ((select valor::uuid from contexto where clave = 'chat'), tests.id_de('ana'),
             (select valor from contexto where clave = 'nota'), 600000) $$,
  '23514',
  null,
  'Una nota de más de dos minutos se rechaza'
);
select throws_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo, audio_ruta)
     values ((select valor::uuid from contexto where clave = 'chat'), tests.id_de('ana'), 'Sin duración',
             (select valor from contexto where clave = 'nota')) $$,
  '23514',
  null,
  'Ruta y duración van siempre juntas'
);
select lives_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, audio_ruta, audio_duracion_ms)
     values ((select valor::uuid from contexto where clave = 'chat'), tests.id_de('ana'),
             (select valor from contexto where clave = 'nota'), 4000) $$,
  'Ana envía la nota de voz'
);
select is(
  (select cuerpo from public.mensajes where audio_ruta is not null),
  'Nota de voz',
  'El texto de una nota de voz lo pone el servidor'
);

select tests.entrar_como('beto');
select throws_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, audio_ruta, audio_duracion_ms)
     values ((select valor::uuid from contexto where clave = 'chat'), tests.id_de('beto'),
             (select valor from contexto where clave = 'nota'), 4000) $$,
  '23514',
  null,
  'Beto no puede enviar como suyo un audio de la carpeta de Ana'
);

-- ------------------------------------------------------------------- Oír
select is(
  (select count(*) from storage.objects where bucket_id = 'notas-voz'),
  1::bigint,
  'Beto puede oír la nota que ha recibido'
);
select tests.entrar_como('carla');
select is(
  (select count(*) from storage.objects where bucket_id = 'notas-voz'),
  0::bigint,
  'Carla no puede oír las notas de un chat ajeno'
);

-- --------------------------------------------------------------- Bloqueo
select tests.entrar_como('beto');
insert into public.bloqueos (bloqueador_id, bloqueado_id)
values (tests.id_de('beto'), tests.id_de('ana'));
select is(
  (select count(*) from storage.objects where bucket_id = 'notas-voz'),
  0::bigint,
  'Quien bloquea deja de poder oír las notas de la persona bloqueada'
);
select tests.entrar_como('ana');
select is(
  (select count(*) from storage.objects where bucket_id = 'notas-voz'),
  1::bigint,
  'Cada uno sigue viendo sus propias notas'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('notas-voz', (select valor from contexto where clave = 'otra'), tests.id_de('ana')) $$,
  '42501',
  null,
  'La bloqueada no puede subir más notas a esa conversación'
);

-- ------------------------------------------------- Sin mensaje no hay audio
select tests.salir();
delete from public.bloqueos;
delete from public.mensajes where audio_ruta is not null;
select tests.entrar_como('beto');
select is(
  (select count(*) from storage.objects where bucket_id = 'notas-voz'),
  0::bigint,
  'Al borrarse el mensaje, su audio deja de ser accesible para el destinatario'
);

select * from finish();
rollback;
