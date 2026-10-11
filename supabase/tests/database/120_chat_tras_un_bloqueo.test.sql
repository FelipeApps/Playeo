begin;
select plan(11);

delete from private.ajustes;

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');

insert into public.amistades (solicitante_id, destinatario_id, estado) values
  (tests.id_de('ana'), tests.id_de('beto'), 'aceptada');

create temp table contexto (clave text primary key, valor text);
grant all on contexto to authenticated;

-- Ana y Beto hablan, y Beto le manda además una nota de voz.
select tests.entrar_como('ana');
insert into contexto
select 'chat', public.abrir_conversacion_directa(tests.id_de('beto'))::text;
insert into public.mensajes (conversacion_id, autor_id, cuerpo)
values ((select valor::uuid from contexto where clave = 'chat'), tests.id_de('ana'), 'Hola Beto');

select tests.entrar_como('beto');
insert into public.mensajes (conversacion_id, autor_id, cuerpo)
values ((select valor::uuid from contexto where clave = 'chat'), tests.id_de('beto'), 'Hola Ana');
insert into contexto
select 'nota', tests.id_de('beto')::text || '/' || valor || '/nota.m4a' from contexto where clave = 'chat';
insert into storage.objects (bucket_id, name, owner)
values ('notas-voz', (select valor from contexto where clave = 'nota'), tests.id_de('beto'));
insert into public.mensajes (conversacion_id, autor_id, audio_ruta, audio_duracion_ms)
values ((select valor::uuid from contexto where clave = 'chat'), tests.id_de('beto'),
        (select valor from contexto where clave = 'nota'), 3000);

select tests.entrar_como('ana');
select is(
  (select string_agg(puedo_escribir::text, ',') from public.mis_conversaciones()),
  'true',
  'Sin bloqueo, Ana puede escribir en la conversación'
);

-- ------------------------------------------------------- Beto bloquea a Ana
-- Se retiran los avisos de los mensajes anteriores para ver solo lo que provoca el bloqueo.
select tests.salir();
delete from public.notificaciones;
select tests.entrar_como('beto');
insert into public.bloqueos (bloqueador_id, bloqueado_id)
values (tests.id_de('beto'), tests.id_de('ana'));

select is(
  (select count(*) from public.mis_conversaciones()),
  0::bigint,
  'Quien bloquea deja de ver la conversación en su lista'
);
select is(
  (select count(*) from public.mensajes where autor_id = tests.id_de('ana')),
  0::bigint,
  'Quien bloquea deja de ver los mensajes de la persona bloqueada'
);
select throws_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo)
     values ((select valor::uuid from contexto where clave = 'chat'), tests.id_de('beto'), 'Me arrepiento') $$,
  '42501',
  null,
  'Quien bloquea tampoco puede escribir mientras dure el bloqueo'
);

select tests.entrar_como('ana');
select is(
  (select string_agg(titulo || ':' || puedo_escribir::text, ',') from public.mis_conversaciones()),
  'Beto:false',
  'La persona bloqueada conserva la conversación, sin poder escribir'
);
select is(
  (select count(*) from public.mensajes),
  3::bigint,
  'Y sigue leyendo todo el historial, también lo que escribió quien la bloqueó'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'notas-voz'),
  1::bigint,
  'Incluida la nota de voz que ya había recibido'
);
select is(
  (select ultimo_cuerpo from public.mis_conversaciones()),
  'Nota de voz',
  'La lista sigue enseñando el último mensaje de la conversación'
);
select throws_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo)
     values ((select valor::uuid from contexto where clave = 'chat'), tests.id_de('ana'), '¿Sigues ahí?') $$,
  '42501',
  null,
  'El servidor rechaza cualquier envío de la persona bloqueada'
);
select is(
  (select count(*) from public.notificaciones),
  0::bigint,
  'A la persona bloqueada no le llega ningún aviso del bloqueo'
);

-- ---------------------------------------------------- Ana bloquea a su vez
insert into public.bloqueos (bloqueador_id, bloqueado_id)
values (tests.id_de('ana'), tests.id_de('beto'));
select is(
  (select count(*) from public.mis_conversaciones()),
  0::bigint,
  'Si ella también bloquea, la conversación desaparece también de su lista'
);

select * from finish();
rollback;
