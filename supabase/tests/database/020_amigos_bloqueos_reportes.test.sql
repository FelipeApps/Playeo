begin;
select plan(27);

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');
select tests.crear_usuario('carla');
update public.perfiles set privacidad = 'amigos' where nombre_usuario = 'beto';

-- ---------------------------------------------------------------- Solicitudes
select tests.entrar_como('ana');
select lives_ok(
  $$ insert into public.amistades (solicitante_id, destinatario_id)
     values (tests.id_de('ana'), tests.id_de('beto')) $$,
  'Ana envía una solicitud a Beto'
);
select throws_ok(
  $$ insert into public.amistades (solicitante_id, destinatario_id)
     values (tests.id_de('carla'), tests.id_de('beto')) $$,
  '42501',
  null,
  'Ana no puede enviar solicitudes en nombre de Carla'
);
select throws_ok(
  $$ insert into public.amistades (solicitante_id, destinatario_id, estado)
     values (tests.id_de('ana'), tests.id_de('carla'), 'aceptada') $$,
  '42501',
  null,
  'No se puede crear una amistad ya aceptada'
);
select is(
  (select count(*) from public.perfiles where nombre_usuario = 'beto'),
  0::bigint,
  'Con la solicitud pendiente, Ana aún no ve el perfil "solo amigos" de Beto'
);

update public.amistades set estado = 'aceptada' where solicitante_id = tests.id_de('ana');
select is(
  (select estado from public.amistades where solicitante_id = tests.id_de('ana')),
  'pendiente'::public.estado_amistad,
  'Quien envía la solicitud no puede aceptársela a sí mismo'
);

select tests.entrar_como('carla');
select is(
  (select count(*) from public.amistades),
  0::bigint,
  'Carla no ve las solicitudes entre Ana y Beto'
);

select tests.entrar_como('beto');
select throws_ok(
  $$ insert into public.amistades (solicitante_id, destinatario_id)
     values (tests.id_de('beto'), tests.id_de('ana')) $$,
  '23505',
  null,
  'No puede haber dos solicitudes cruzadas entre las mismas personas'
);
select is(
  (select relacion from public.mis_relaciones() where nombre_usuario = 'ana'),
  'solicitud_recibida'::public.relacion_usuario,
  'Beto ve de quién es la solicitud que ha recibido'
);
update public.amistades set estado = 'aceptada' where destinatario_id = tests.id_de('beto');
select is(
  (select estado from public.amistades where destinatario_id = tests.id_de('beto')),
  'aceptada'::public.estado_amistad,
  'Beto acepta la solicitud'
);

-- ------------------------------------------------------- Perfil solo amigos
select tests.entrar_como('ana');
select is(
  (select count(*) from public.perfiles where nombre_usuario = 'beto'),
  1::bigint,
  'Ya amigos, Ana ve el perfil "solo amigos" de Beto'
);
select tests.entrar_como('carla');
select is(
  (select count(*) from public.perfiles where nombre_usuario = 'beto'),
  0::bigint,
  'Carla, que no es amiga, no ve el perfil de Beto'
);
select is(
  (select count(*) from public.buscar_usuarios('bet')),
  1::bigint,
  'Carla sí puede encontrar a Beto por su nombre de usuario'
);
select is(
  (select bio is null and not perfil_visible from public.ver_usuario(tests.id_de('beto'))),
  true,
  'La ficha de Beto no enseña a Carla su biografía'
);
select is(
  (select count(*) from public.buscar_usuarios('carla')),
  0::bigint,
  'La búsqueda no me devuelve a mí misma'
);
select is(
  (select count(*) from public.buscar_usuarios('%')),
  0::bigint,
  'La búsqueda no admite comodines para listar a todo el mundo'
);

-- ------------------------------------------------------------------ Bloqueos
select tests.entrar_como('beto');
select throws_ok(
  $$ insert into public.bloqueos (bloqueador_id, bloqueado_id)
     values (tests.id_de('ana'), tests.id_de('carla')) $$,
  '42501',
  null,
  'No se puede bloquear en nombre de otra persona'
);
insert into public.bloqueos (bloqueador_id, bloqueado_id)
values (tests.id_de('beto'), tests.id_de('ana'));
select tests.salir();
select is(
  (select count(*) from public.amistades where destinatario_id = tests.id_de('beto')),
  0::bigint,
  'Al bloquear se rompe la amistad'
);
update public.perfiles set privacidad = 'publico' where nombre_usuario = 'beto';

select tests.entrar_como('ana');
select is(
  (select count(*) from public.perfiles where nombre_usuario = 'beto'),
  0::bigint,
  'La bloqueada no ve el perfil de quien la bloqueó, aunque sea público'
);
select is(
  (select count(*) from public.bloqueos),
  0::bigint,
  'La bloqueada no puede saber que está bloqueada'
);
select throws_ok(
  $$ insert into public.amistades (solicitante_id, destinatario_id)
     values (tests.id_de('ana'), tests.id_de('beto')) $$,
  '42501',
  null,
  'La bloqueada no puede enviar una solicitud a quien la bloqueó'
);
select is(
  (select count(*) from public.buscar_usuarios('beto')),
  0::bigint,
  'La bloqueada no encuentra en la búsqueda a quien la bloqueó'
);
select is(
  (select count(*) from public.ver_usuario(tests.id_de('beto'))),
  0::bigint,
  'La bloqueada no puede abrir la ficha de quien la bloqueó'
);

select tests.entrar_como('beto');
select is(
  (select count(*) from public.perfiles where nombre_usuario = 'ana'),
  0::bigint,
  'Quien bloquea tampoco ve el perfil de la persona bloqueada'
);
select is(
  (select count(*) from public.mis_bloqueados()),
  1::bigint,
  'Beto ve su lista de bloqueados'
);

-- ------------------------------------------------------------------ Reportes
select tests.entrar_como('ana');
insert into public.reportes (reportante_id, usuario_reportado_id, motivo, detalles)
values (tests.id_de('ana'), tests.id_de('carla'), 'spam', 'Publicidad');
select throws_ok(
  $$ insert into public.reportes (reportante_id, usuario_reportado_id, motivo)
     values (tests.id_de('beto'), tests.id_de('carla'), 'acoso') $$,
  '42501',
  null,
  'No se puede reportar en nombre de otra persona'
);
update public.reportes set estado = 'cerrado';
select tests.salir();
select is(
  (select estado from public.reportes where reportante_id = tests.id_de('ana')),
  'abierto'::public.estado_reporte,
  'Quien no modera no puede cambiar el estado de un reporte, ni del suyo'
);
select tests.entrar_como('carla');
select is(
  (select count(*) from public.reportes),
  0::bigint,
  'La persona reportada no ve el reporte'
);
select tests.salir();

select * from finish();
rollback;
