begin;
select plan(20);

-- En los tests no se envían push: se vacían los ajustes dentro de la transacción.
delete from private.ajustes;

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');
select tests.crear_usuario('carla');

-- ------------------------------------------------------------------- Amistad
select tests.entrar_como('ana');
insert into public.amistades (solicitante_id, destinatario_id)
values (tests.id_de('ana'), tests.id_de('beto'));

select tests.entrar_como('beto');
select is(
  (select count(*) from public.notificaciones where tipo = 'solicitud_amistad'),
  1::bigint,
  'Quien recibe una solicitud de amistad recibe su notificación'
);
select is(
  (select actor_nombre from public.mis_notificaciones() limit 1),
  'Ana',
  'La notificación dice de quién es'
);
select tests.entrar_como('carla');
select is(
  (select count(*) from public.notificaciones),
  0::bigint,
  'Nadie ve las notificaciones de otra persona'
);
select throws_ok(
  $$ insert into public.notificaciones (usuario_id, tipo) values (tests.id_de('beto'), 'mensaje_nuevo') $$,
  '42501',
  null,
  'No se pueden crear notificaciones desde la app'
);
update public.notificaciones set leida = now();
select tests.salir();
select is(
  (select count(*) from public.notificaciones where usuario_id = tests.id_de('beto') and leida is not null),
  0::bigint,
  'Nadie puede marcar como leídas las notificaciones de otra persona'
);

select tests.entrar_como('beto');
update public.amistades set estado = 'aceptada' where destinatario_id = tests.id_de('beto');
select is(
  (select count(*) from public.notificaciones where tipo = 'solicitud_amistad'),
  0::bigint,
  'Al responder la solicitud, su notificación desaparece'
);
select tests.entrar_como('ana');
select is(
  (select count(*) from public.notificaciones where tipo = 'amistad_aceptada'),
  1::bigint,
  'Quien envió la solicitud se entera de que la han aceptado'
);
select throws_ok(
  $$ update public.notificaciones set usuario_id = tests.id_de('carla') $$,
  '42501',
  null,
  'De una notificación solo se puede cambiar si está leída'
);

-- ----------------------------------------------------------------- Mensajes
create temp table contexto (conversacion uuid);
grant all on contexto to authenticated;
insert into contexto select public.abrir_conversacion_directa(tests.id_de('beto'));
insert into public.mensajes (conversacion_id, autor_id, cuerpo)
values ((select conversacion from contexto), tests.id_de('ana'), 'Primero');
insert into public.mensajes (conversacion_id, autor_id, cuerpo)
values ((select conversacion from contexto), tests.id_de('ana'), 'Segundo');
select is(
  (select count(*) from public.notificaciones where tipo = 'mensaje_nuevo'),
  0::bigint,
  'Quien escribe no se notifica a sí mismo'
);

select tests.entrar_como('beto');
select is(
  (select count(*) from public.notificaciones where tipo = 'mensaje_nuevo'),
  1::bigint,
  'Varios mensajes de una conversación dejan un solo aviso sin leer'
);
select is(
  (select datos ->> 'extracto' from public.notificaciones where tipo = 'mensaje_nuevo'),
  'Segundo',
  'El aviso lleva el extracto del último mensaje'
);
select public.marcar_conversacion_leida((select conversacion from contexto));
select is(
  (select count(*) from public.notificaciones where tipo = 'mensaje_nuevo' and leida is null),
  0::bigint,
  'Leer la conversación deja leído su aviso'
);

-- Con bloqueo no se generan avisos.
insert into public.bloqueos (bloqueador_id, bloqueado_id)
values (tests.id_de('beto'), tests.id_de('ana'));
select tests.salir();
select private.notificar(tests.id_de('beto'), 'mensaje_nuevo', tests.id_de('ana'),
  jsonb_build_object('conversacion_id', gen_random_uuid()));
select is(
  (select count(*) from public.notificaciones
   where usuario_id = tests.id_de('beto') and tipo = 'mensaje_nuevo' and leida is null),
  0::bigint,
  'Un bloqueado no puede generar notificaciones a quien le bloqueó'
);

-- ------------------------------------------------------------------- Tokens
select tests.entrar_como('ana');
select lives_ok(
  $$ select public.registrar_token_push('ExponentPushToken[prueba-de-ana]', 'android') $$,
  'Ana registra su dispositivo'
);
select throws_ok(
  $$ select public.registrar_token_push('token-con-formato-raro', 'android') $$,
  '23514',
  null,
  'Solo se aceptan tokens de Expo'
);
select throws_ok(
  $$ insert into public.tokens_push (token, usuario_id, plataforma)
     values ('ExponentPushToken[colado]', tests.id_de('beto'), 'ios') $$,
  '42501',
  null,
  'No se pueden registrar dispositivos a nombre de otra persona'
);
select tests.entrar_como('carla');
select is(
  (select count(*) from public.tokens_push),
  0::bigint,
  'Nadie ve los dispositivos de otra persona'
);
select public.registrar_token_push('ExponentPushToken[prueba-de-ana]', 'android');
select tests.salir();
select is(
  (select usuario_id from public.tokens_push where token = 'ExponentPushToken[prueba-de-ana]'),
  tests.id_de('carla'),
  'Si otra cuenta inicia sesión en el mismo móvil, el dispositivo pasa a ser suyo'
);

-- ------------------------------------------------------------------ Ajustes
select tests.entrar_como('ana');
select throws_ok(
  $$ select * from private.ajustes $$,
  '42501',
  null,
  'La app no puede leer los ajustes internos (secreto de push)'
);
select tests.entrar_como_anonimo();
select throws_ok(
  $$ select * from public.notificaciones $$,
  '42501',
  null,
  'Sin sesión no se leen notificaciones'
);
select tests.salir();

select * from finish();
rollback;
