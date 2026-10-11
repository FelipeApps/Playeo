begin;
select plan(17);

-- En los tests no se envían push: se vacían los ajustes dentro de la transacción.
delete from private.ajustes;

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');
select tests.crear_usuario('carla');

insert into public.amistades (solicitante_id, destinatario_id, estado) values
  (tests.id_de('ana'), tests.id_de('beto'), 'aceptada'),
  (tests.id_de('ana'), tests.id_de('carla'), 'aceptada');
delete from public.notificaciones;

create temp table contexto (clave text primary key, id uuid);
grant all on contexto to authenticated;

-- --------------------------------------------------------- Alguien se apunta
select tests.entrar_como('ana');
with nueva as (
  insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad)
  values (tests.id_de('ana'), 'amadores', 'Baño de prueba', now() + interval '3 days', 'amigos')
  returning id
)
insert into contexto select 'quedada', id from nueva;
select is(
  (select count(*) from public.notificaciones),
  0::bigint,
  'Crear una quedada no avisa a quien la crea'
);

select tests.entrar_como('beto');
insert into public.asistencias_evento (evento_id, usuario_id, respuesta)
values ((select id from contexto where clave = 'quedada'), tests.id_de('beto'), 'quiza');
select tests.entrar_como('ana');
select is(
  (select count(*) from public.notificaciones where tipo = 'asistencia_evento'),
  0::bigint,
  'Un «quizá» no avisa a quien organiza'
);

select tests.entrar_como('beto');
update public.asistencias_evento set respuesta = 'voy' where usuario_id = tests.id_de('beto');
select tests.entrar_como('ana');
select is(
  (select actor_nombre || ' · ' || (datos ->> 'titulo')
   from public.mis_notificaciones() where tipo = 'asistencia_evento'),
  'Beto · Baño de prueba',
  'Quien organiza recibe el aviso de que Beto se apunta, con el título de la quedada'
);

select tests.entrar_como('beto');
update public.asistencias_evento set respuesta = 'no_voy' where usuario_id = tests.id_de('beto');
update public.asistencias_evento set respuesta = 'voy' where usuario_id = tests.id_de('beto');
select tests.entrar_como('ana');
select is(
  (select count(*) from public.notificaciones where tipo = 'asistencia_evento'),
  1::bigint,
  'Cambiar de idea y volver a apuntarse deja un solo aviso'
);
select tests.entrar_como('carla');
select is(
  (select count(*) from public.notificaciones),
  0::bigint,
  'Quien no organiza no recibe los avisos de asistencia'
);

-- ------------------------------------------------- Cambia la hora o el lugar
insert into public.asistencias_evento (evento_id, usuario_id, respuesta)
values ((select id from contexto where clave = 'quedada'), tests.id_de('carla'), 'no_voy');
select tests.entrar_como('ana');
update public.eventos set titulo = 'Baño con otro nombre'
where id = (select id from contexto where clave = 'quedada');
select tests.entrar_como('beto');
select is(
  (select count(*) from public.notificaciones where tipo = 'evento_cambiado'),
  0::bigint,
  'Cambiar solo el título no avisa a nadie'
);
select tests.entrar_como('ana');
update public.eventos set empieza = now() + interval '4 days'
where id = (select id from contexto where clave = 'quedada');
update public.eventos set empieza = now() + interval '5 days'
where id = (select id from contexto where clave = 'quedada');
select is(
  (select count(*) from public.notificaciones where tipo = 'evento_cambiado'),
  0::bigint,
  'Quien cambia la quedada no se avisa a sí mismo'
);
select tests.entrar_como('beto');
select is(
  (select string_agg(datos ->> 'cambio', ',') from public.notificaciones where tipo = 'evento_cambiado'),
  'fecha',
  'Quien va recibe un único aviso del cambio de hora'
);
select tests.entrar_como('carla');
select is(
  (select count(*) from public.notificaciones where tipo = 'evento_cambiado'),
  0::bigint,
  'Quien dijo que no va no recibe los cambios'
);

-- ------------------------------------------------------------- Recordatorio
select tests.salir();
select is(private.enviar_recordatorios(), 0, 'Una quedada lejana no se recuerda todavía');
update public.eventos set empieza = now() + interval '1 hour', creado = now() - interval '1 day'
where id = (select id from contexto where clave = 'quedada');
select is(private.enviar_recordatorios(), 1, 'Una quedada que empieza en una hora se recuerda');
select is(private.enviar_recordatorios(), 0, 'El recordatorio se envía una sola vez');
select is(
  (select count(*) from public.notificaciones where tipo = 'recordatorio_evento'),
  2::bigint,
  'Lo reciben quienes van: quien organiza y Beto, pero no Carla'
);
select tests.entrar_como('beto');
select throws_ok(
  $$ select private.enviar_recordatorios() $$,
  '42501',
  null,
  'La app no puede lanzar los recordatorios'
);

-- -------------------------------------------------------------- Cancelación
select tests.entrar_como('ana');
delete from public.eventos where id = (select id from contexto where clave = 'quedada');
select tests.entrar_como('beto');
select is(
  (select string_agg(tipo::text || ':' || (datos ->> 'organizador'), ',') from public.notificaciones),
  'evento_cancelado:Ana',
  'Al cancelarse, a Beto solo le queda el aviso de cancelación, con quién la organizaba'
);

-- ------------------------------------------------------- Alguien entra al grupo
select tests.entrar_como('ana');
insert into contexto select 'grupo', public.crear_grupo('Grupo de avisos', null);
select tests.salir();
delete from public.notificaciones;
insert into public.miembros_grupo (grupo_id, usuario_id)
values ((select id from contexto where clave = 'grupo'), tests.id_de('carla'));
select tests.entrar_como('ana');
select is(
  (select actor_nombre || ' · ' || (datos ->> 'titulo')
   from public.mis_notificaciones() where tipo = 'miembro_grupo'),
  'Carla · Grupo de avisos',
  'Quien administra el grupo recibe el aviso de que Carla ha entrado'
);
select tests.entrar_como('carla');
select is(
  (select count(*) from public.notificaciones where tipo = 'miembro_grupo'),
  0::bigint,
  'Quien entra no recibe aviso de su propia entrada'
);

select * from finish();
rollback;
