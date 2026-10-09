begin;
select plan(33);

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');
select tests.crear_usuario('carla');
select tests.crear_usuario('dani');
select tests.crear_usuario('eva');

-- Ana es amiga de Beto y de Eva. Beto es amigo de Dani. Carla no es amiga de nadie.
-- Ana ha bloqueado a Dani.
insert into public.amistades (solicitante_id, destinatario_id, estado) values
  (tests.id_de('ana'), tests.id_de('beto'), 'aceptada'),
  (tests.id_de('ana'), tests.id_de('eva'), 'aceptada'),
  (tests.id_de('beto'), tests.id_de('dani'), 'aceptada');
insert into public.bloqueos (bloqueador_id, bloqueado_id)
values (tests.id_de('ana'), tests.id_de('dani'));

insert into public.lugares (id, nombre, region) values ('playa-de-prueba', 'Playa de prueba', 'zona-de-prueba');

create temp table contexto (clave text primary key, id uuid);
grant all on contexto to authenticated;
insert into contexto values ('grupo', gen_random_uuid());

insert into public.grupos (id, nombre) values ((select id from contexto where clave = 'grupo'), 'Grupo de Ana');
insert into public.miembros_grupo (grupo_id, usuario_id, rol) values
  ((select id from contexto where clave = 'grupo'), tests.id_de('ana'), 'admin'),
  ((select id from contexto where clave = 'grupo'), tests.id_de('eva'), 'miembro');

-- ------------------------------------------------------------------- Creación
select tests.entrar_como('ana');
select lives_ok(
  $$ with nuevo as (
       insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad, plazas_maximas, enlace_whatsapp)
       values (tests.id_de('ana'), 'playa-de-prueba', 'Baño al atardecer', now() + interval '2 days',
               'amigos', 2, 'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv')
       returning id
     )
     insert into contexto select 'de_amigos', id from nuevo $$,
  'Ana crea un evento para sus amigos'
);
with nuevo as (
  insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad, grupo_id)
  values (tests.id_de('ana'), 'playa-de-prueba', 'Surf del grupo', now() + interval '3 days', 'grupo',
          (select id from contexto where clave = 'grupo'))
  returning id
)
insert into contexto select 'de_grupo', id from nuevo;
with nuevo as (
  insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad)
  values (tests.id_de('ana'), 'playa-de-prueba', 'Limpieza de playa', now() + interval '4 days', 'publico')
  returning id
)
insert into contexto select 'publico', id from nuevo;

select is(
  (select respuesta from public.asistencias_evento
   where evento_id = (select id from contexto where clave = 'de_amigos') and usuario_id = tests.id_de('ana')),
  'voy'::public.respuesta_evento,
  'Quien crea el evento queda apuntada'
);
select throws_ok(
  $$ insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad)
     values (tests.id_de('beto'), 'playa-de-prueba', 'Falso', now() + interval '1 day', 'publico') $$,
  '42501',
  null,
  'No se puede crear un evento en nombre de otra persona'
);
select throws_ok(
  $$ insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad)
     values (tests.id_de('ana'), 'playa-de-prueba', 'Ayer', now() - interval '1 day', 'publico') $$,
  '42501',
  null,
  'No se pueden crear eventos en el pasado'
);
select throws_ok(
  $$ insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad)
     values (tests.id_de('ana'), 'playa-inventada', 'Sin playa', now() + interval '1 day', 'publico') $$,
  '23503',
  null,
  'El evento tiene que ser en una playa del catálogo'
);

select tests.entrar_como('beto');
select throws_ok(
  $$ insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad, grupo_id)
     values (tests.id_de('beto'), 'playa-de-prueba', 'Me cuelo', now() + interval '1 day', 'grupo',
             (select id from contexto where clave = 'grupo')) $$,
  '42501',
  null,
  'No se puede crear un evento de un grupo al que no se pertenece'
);

-- ------------------------------------------------- Visibilidad: solo amigos
select is(
  (select count(*) from public.eventos where id = (select id from contexto where clave = 'de_amigos')),
  1::bigint,
  'Un amigo ve el evento "solo amigos"'
);
select tests.entrar_como('carla');
select is(
  (select count(*) from public.eventos where id = (select id from contexto where clave = 'de_amigos')),
  0::bigint,
  'Quien no es amigo no ve el evento "solo amigos"'
);
select is(
  (select count(*) from public.asistencias_evento where evento_id = (select id from contexto where clave = 'de_amigos')),
  0::bigint,
  'Ni ve quién va'
);
select is(
  (select count(*) from public.detalle_evento((select id from contexto where clave = 'de_amigos'))),
  0::bigint,
  'Ni puede abrir su ficha'
);
select throws_ok(
  $$ insert into public.asistencias_evento (evento_id, usuario_id, respuesta)
     values ((select id from contexto where clave = 'de_amigos'), tests.id_de('carla'), 'voy') $$,
  '42501',
  null,
  'Ni puede apuntarse a un evento que no ve'
);

-- --------------------------------------------------- Visibilidad: de grupo
select is(
  (select count(*) from public.eventos where id = (select id from contexto where clave = 'de_grupo')),
  0::bigint,
  'Quien no está en el grupo no ve el evento del grupo'
);
select tests.entrar_como('beto');
select is(
  (select count(*) from public.eventos where id = (select id from contexto where clave = 'de_grupo')),
  0::bigint,
  'Ni siquiera un amigo de quien lo creó, si no está en el grupo'
);
select tests.entrar_como('eva');
select is(
  (select count(*) from public.eventos where id = (select id from contexto where clave = 'de_grupo')),
  1::bigint,
  'Un miembro del grupo sí lo ve'
);

-- ----------------------------------------------------- Visibilidad: público
select tests.entrar_como('carla');
select is(
  (select count(*) from public.eventos where id = (select id from contexto where clave = 'publico')),
  1::bigint,
  'Un evento público lo ve cualquiera con sesión'
);
select throws_ok(
  $$ select enlace_whatsapp from public.eventos $$,
  '42501',
  null,
  'El enlace de WhatsApp no se puede leer de la tabla'
);
select tests.entrar_como('dani');
select is(
  (select count(*) from public.eventos),
  0::bigint,
  'Un bloqueado no ve ningún evento de quien le bloqueó, ni los públicos'
);
select is(
  (select count(*) from public.eventos_visibles()),
  0::bigint,
  'Tampoco en la lista de quedadas'
);
select tests.entrar_como_anonimo();
select throws_ok($$ select * from public.eventos $$, '42501', null, 'Sin sesión no se leen eventos');

-- ------------------------------------------------------- Asistencia y plazas
select tests.entrar_como('beto');
select is(
  (select enlace_whatsapp from public.detalle_evento((select id from contexto where clave = 'de_amigos'))),
  null,
  'Antes de apuntarse no se ve el enlace de WhatsApp'
);
select lives_ok(
  $$ insert into public.asistencias_evento (evento_id, usuario_id, respuesta)
     values ((select id from contexto where clave = 'de_amigos'), tests.id_de('beto'), 'voy') $$,
  'Beto ocupa la segunda y última plaza'
);
select isnt(
  (select enlace_whatsapp from public.detalle_evento((select id from contexto where clave = 'de_amigos'))),
  null,
  'Al apuntarse ya ve el enlace de WhatsApp'
);
select is(
  (
    select count(*) from public.miembros_conversacion mc
    join public.conversaciones c on c.id = mc.conversacion_id
    where c.evento_id = (select id from contexto where clave = 'de_amigos')
  ),
  2::bigint,
  'Quien va entra en el chat del evento'
);

select tests.entrar_como('eva');
select throws_ok(
  $$ insert into public.asistencias_evento (evento_id, usuario_id, respuesta)
     values ((select id from contexto where clave = 'de_amigos'), tests.id_de('eva'), 'voy') $$,
  '23514',
  null,
  'Con las plazas completas no se puede decir "voy"'
);
select lives_ok(
  $$ insert into public.asistencias_evento (evento_id, usuario_id, respuesta)
     values ((select id from contexto where clave = 'de_amigos'), tests.id_de('eva'), 'quiza') $$,
  'Pero sí "quizá"'
);

select tests.entrar_como('beto');
update public.asistencias_evento set respuesta = 'no_voy' where usuario_id = tests.id_de('beto');
update public.asistencias_evento set respuesta = 'no_voy' where usuario_id = tests.id_de('eva');
select tests.salir();
select is(
  (select respuesta from public.asistencias_evento
   where evento_id = (select id from contexto where clave = 'de_amigos') and usuario_id = tests.id_de('eva')),
  'quiza'::public.respuesta_evento,
  'Nadie puede cambiar la respuesta de otra persona'
);
select is(
  (
    select count(*) from public.miembros_conversacion mc
    join public.conversaciones c on c.id = mc.conversacion_id
    where c.evento_id = (select id from contexto where clave = 'de_amigos')
      and mc.usuario_id = tests.id_de('beto')
  ),
  0::bigint,
  'Quien pasa a "no voy" sale del chat del evento'
);

-- --------------------------------------------------------------- Invitaciones
-- Beto no está en el grupo: solo verá el evento del grupo si le invitan.
select tests.entrar_como('ana');
select lives_ok(
  $$ insert into public.invitaciones_evento (evento_id, invitado_id, invitador_id)
     values ((select id from contexto where clave = 'de_grupo'), tests.id_de('beto'), tests.id_de('ana')) $$,
  'Ana invita a su amigo Beto al evento del grupo'
);
select tests.entrar_como('beto');
select is(
  (select count(*) from public.eventos where id = (select id from contexto where clave = 'de_grupo')),
  1::bigint,
  'Con la invitación, Beto ya ve el evento'
);
insert into public.asistencias_evento (evento_id, usuario_id, respuesta)
values ((select id from contexto where clave = 'de_grupo'), tests.id_de('beto'), 'voy');
select is(
  (select count(*) from public.invitaciones_evento),
  0::bigint,
  'Al responder, la invitación se consume'
);
-- Beto va y es amigo de Dani, pero Ana (la creadora) tiene bloqueado a Dani.
select throws_ok(
  $$ insert into public.invitaciones_evento (evento_id, invitado_id, invitador_id)
     values ((select id from contexto where clave = 'de_grupo'), tests.id_de('dani'), tests.id_de('beto')) $$,
  '42501',
  null,
  'No se puede invitar a alguien bloqueado por quien creó el evento'
);

-- ---------------------------------------------------------- Edición y borrado
update public.eventos set titulo = 'Cambiado por Beto';
delete from public.eventos;
select tests.salir();
select is(
  (select titulo from public.eventos where id = (select id from contexto where clave = 'de_grupo')),
  'Surf del grupo',
  'Solo quien creó el evento puede editarlo'
);
select is(
  (select count(*) from public.eventos where creador_id = tests.id_de('ana')),
  3::bigint,
  'Y solo quien lo creó puede eliminarlo'
);

select * from finish();
rollback;
