begin;
select plan(8);

delete from private.ajustes;

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');

insert into public.amistades (solicitante_id, destinatario_id, estado) values
  (tests.id_de('ana'), tests.id_de('beto'), 'aceptada');

create temp table contexto (clave text primary key, id uuid);
grant all on contexto to authenticated;

-- ------------------------------------------------------------------ Mensajes
select tests.entrar_como('ana');
insert into contexto select 'chat', public.abrir_conversacion_directa(tests.id_de('beto'));

select lives_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo)
     select (select id from contexto where clave = 'chat'), tests.id_de('ana'), 'Mensaje ' || n
     from generate_series(1, 30) n $$,
  'Treinta mensajes en un minuto entran'
);
select throws_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo)
     values ((select id from contexto where clave = 'chat'), tests.id_de('ana'), 'Uno más') $$,
  'PT429',
  null,
  'El mensaje treinta y uno del mismo minuto se rechaza'
);

select tests.entrar_como('beto');
select lives_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo)
     values ((select id from contexto where clave = 'chat'), tests.id_de('beto'), 'Yo sí puedo') $$,
  'El límite es por persona: Beto sigue pudiendo escribir'
);

-- Pasado el minuto, Ana vuelve a poder escribir.
select tests.salir();
update public.mensajes set creado = now() - interval '2 minutes' where autor_id = tests.id_de('ana');
select tests.entrar_como('ana');
select lives_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo)
     values ((select id from contexto where clave = 'chat'), tests.id_de('ana'), 'Ya pasó') $$,
  'Al salir de la ventana de un minuto, el límite se levanta'
);

-- ------------------------------------------------------------------ Quedadas
select lives_ok(
  $$ insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad)
     select tests.id_de('ana'), 'amadores', 'Quedada ' || n, now() + interval '2 days', 'amigos'
     from generate_series(1, 10) n $$,
  'Diez quedadas en un día entran'
);
select throws_ok(
  $$ insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad)
     values (tests.id_de('ana'), 'amadores', 'La undécima', now() + interval '2 days', 'amigos') $$,
  'PT429',
  null,
  'La undécima quedada del día se rechaza'
);

-- ------------------------------------------------------------------- Grupos
select lives_ok(
  $$ select public.crear_grupo('Grupo ' || n, null) from generate_series(1, 5) n $$,
  'Cinco grupos en un día entran'
);
select throws_ok(
  $$ select public.crear_grupo('El sexto', null) $$,
  'PT429',
  null,
  'El sexto grupo del día se rechaza, también a través de la función'
);

select * from finish();
rollback;
