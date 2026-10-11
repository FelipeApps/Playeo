begin;
select plan(30);

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');
select tests.crear_usuario('carla');

insert into public.amistades (solicitante_id, destinatario_id, estado) values
  (tests.id_de('ana'), tests.id_de('beto'), 'aceptada');

create temp table contexto (clave text primary key, id uuid);
grant all on contexto to authenticated;

-- ------------------------------------------------------- Conversación directa
select tests.entrar_como('ana');
insert into contexto
select 'directa', public.abrir_conversacion_directa(tests.id_de('beto'));
select is(
  public.abrir_conversacion_directa(tests.id_de('beto')),
  (select id from contexto where clave = 'directa'),
  'Entre dos personas hay una sola conversación directa'
);
select throws_ok(
  $$ select public.abrir_conversacion_directa(tests.id_de('carla')) $$,
  '42501',
  null,
  'No se puede abrir una conversación con quien no es amigo'
);
select lives_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo)
     values ((select id from contexto where clave = 'directa'), tests.id_de('ana'), 'Hola Beto') $$,
  'Ana escribe a Beto'
);
select throws_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo)
     values ((select id from contexto where clave = 'directa'), tests.id_de('beto'), 'Falso') $$,
  '42501',
  null,
  'Ana no puede escribir en nombre de Beto'
);

-- Dentro de un test todo ocurre en el mismo instante (now() es fijo en la transacción),
-- así que se atrasa la marca de lectura de Beto para que el mensaje cuente como nuevo.
select tests.salir();
update public.miembros_conversacion set leido_hasta = now() - interval '1 minute'
where usuario_id = tests.id_de('beto');
create temp table mensaje_de_ana as select max(id) as id from public.mensajes;
grant all on mensaje_de_ana to authenticated;

-- ---------------------------------------------------- Un tercero no ve nada
select tests.entrar_como('carla');
select is(
  (select count(*) from public.conversaciones),
  0::bigint,
  'Carla no ve la conversación entre Ana y Beto'
);
select is(
  (select count(*) from public.mensajes),
  0::bigint,
  'Carla no puede leer los mensajes de un chat ajeno'
);
select is(
  (select count(*) from public.miembros_conversacion),
  0::bigint,
  'Carla no ve quién participa en un chat ajeno'
);
select is(
  (select count(*) from public.participantes_conversacion((select id from contexto where clave = 'directa'))),
  0::bigint,
  'Tampoco a través de la función de participantes'
);
select throws_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo)
     values ((select id from contexto where clave = 'directa'), tests.id_de('carla'), 'Me cuelo') $$,
  '42501',
  null,
  'Carla no puede escribir en un chat ajeno'
);
select throws_ok(
  $$ insert into public.miembros_conversacion (conversacion_id, usuario_id)
     values ((select id from contexto where clave = 'directa'), tests.id_de('carla')) $$,
  '42501',
  null,
  'Nadie puede añadirse a una conversación'
);
select is(
  private.puedo_usar_canal('conversacion:' || (select id from contexto where clave = 'directa')),
  false,
  'Carla no puede usar el canal en tiempo real de un chat ajeno'
);

-- ------------------------------------------------------------ Lectura y leído
select tests.entrar_como('beto');
select is(
  (select no_leidos from public.mis_conversaciones()),
  1::bigint,
  'Beto tiene un mensaje sin leer'
);
select is(
  private.puedo_usar_canal('conversacion:' || (select id from contexto where clave = 'directa')),
  true,
  'Beto sí puede usar el canal de su conversación'
);
select is(private.puedo_usar_canal('conversacion:no-es-un-id'), false, 'Un canal mal formado se rechaza');

update public.miembros_conversacion set leido_hasta = now() + interval '1 second'
where usuario_id = tests.id_de('beto');
select is(
  (select no_leidos from public.mis_conversaciones()),
  0::bigint,
  'Al marcar como leída, ya no quedan mensajes pendientes'
);
update public.miembros_conversacion set leido_hasta = '2000-01-01' where usuario_id = tests.id_de('ana');
select tests.salir();
select isnt(
  (select leido_hasta from public.miembros_conversacion where usuario_id = tests.id_de('ana')),
  '2000-01-01'::timestamptz,
  'Nadie puede cambiar la marca de lectura de otra persona'
);

-- -------------------------------------------------------------- Borrar mensajes
select tests.entrar_como('beto');
delete from public.mensajes;
select tests.salir();
select is(
  (select count(*) from public.mensajes where autor_id = tests.id_de('ana')),
  1::bigint,
  'Beto no puede borrar los mensajes de Ana'
);

-- ---------------------------------------------------------- Reportar mensajes
select tests.entrar_como('beto');
select lives_ok(
  $$ insert into public.reportes (reportante_id, usuario_reportado_id, mensaje_id, motivo)
     select tests.id_de('beto'), tests.id_de('ana'), m.id, 'acoso' from public.mensajes m $$,
  'Beto puede reportar un mensaje que ha recibido'
);
select tests.salir();
select tests.entrar_como('carla');
select throws_ok(
  $$ insert into public.reportes (reportante_id, usuario_reportado_id, mensaje_id, motivo)
     select tests.id_de('carla'), tests.id_de('ana'), id, 'acoso' from mensaje_de_ana $$,
  '42501',
  null,
  'Carla no puede reportar un mensaje que no puede leer'
);
select tests.salir();
select is(
  (select count(*) from public.reportes where usuario_reportado_id = tests.id_de('ana')),
  1::bigint,
  'Solo queda guardado el reporte legítimo'
);

-- ------------------------------------------------------------------- Bloqueo
select tests.entrar_como('beto');
insert into public.bloqueos (bloqueador_id, bloqueado_id)
values (tests.id_de('beto'), tests.id_de('ana'));

select tests.entrar_como('ana');
select throws_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo)
     values ((select id from contexto where clave = 'directa'), tests.id_de('ana'), '¿Sigues ahí?') $$,
  '42501',
  null,
  'La bloqueada no puede escribir a quien la bloqueó'
);
select is(
  (select string_agg(puedo_escribir::text, ',') from public.mis_conversaciones()),
  'false',
  'La bloqueada conserva la conversación en su lista, marcada como de solo lectura'
);
select throws_ok(
  $$ select public.abrir_conversacion_directa(tests.id_de('carla')) $$,
  '42501',
  null,
  'Sigue sin poder abrir conversaciones con no amigos'
);

select tests.entrar_como('beto');
select is(
  (select count(*) from public.mensajes),
  0::bigint,
  'Quien bloquea deja de ver los mensajes de la persona bloqueada'
);

-- ----------------------------------------------------------- Chat de grupo
select tests.salir();
delete from public.bloqueos;
insert into contexto select 'grupo', gen_random_uuid();
insert into public.grupos (id, nombre) values ((select id from contexto where clave = 'grupo'), 'Grupo de prueba');
insert into public.miembros_grupo (grupo_id, usuario_id, rol) values
  ((select id from contexto where clave = 'grupo'), tests.id_de('ana'), 'admin'),
  ((select id from contexto where clave = 'grupo'), tests.id_de('carla'), 'miembro');

select is(
  (
    select count(*) from public.miembros_conversacion mc
    join public.conversaciones c on c.id = mc.conversacion_id
    where c.grupo_id = (select id from contexto where clave = 'grupo')
  ),
  2::bigint,
  'Al entrar en un grupo se entra en su chat'
);

select tests.entrar_como('carla');
select lives_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo)
     select c.id, tests.id_de('carla'), 'Hola grupo' from public.conversaciones c where c.tipo = 'grupo' $$,
  'Un miembro escribe en el chat del grupo'
);
select tests.entrar_como('beto');
select is(
  (select count(*) from public.mensajes where cuerpo = 'Hola grupo'),
  0::bigint,
  'Quien no está en el grupo no lee su chat'
);

-- Carla bloquea a Ana: siguen en el grupo, pero Ana no ve los mensajes de Carla.
select tests.entrar_como('carla');
insert into public.bloqueos (bloqueador_id, bloqueado_id)
values (tests.id_de('carla'), tests.id_de('ana'));
select tests.entrar_como('ana');
select is(
  (select count(*) from public.mensajes where cuerpo = 'Hola grupo'),
  0::bigint,
  'En un grupo compartido no se ven los mensajes de alguien con bloqueo'
);

-- Expulsar del grupo es expulsar del chat.
delete from public.miembros_grupo where usuario_id = tests.id_de('carla');
select tests.entrar_como('carla');
select is(
  (select count(*) from public.conversaciones where tipo = 'grupo'),
  0::bigint,
  'Al salir del grupo se pierde el acceso a su chat'
);
select throws_ok(
  $$ insert into public.mensajes (conversacion_id, autor_id, cuerpo)
     select c.id, tests.id_de('carla'), 'Sigo aquí'
     from (select id from contexto where clave = 'grupo') g
     join lateral (select gen_random_uuid() as id) c on true $$,
  '42501',
  null,
  'Y ya no se puede escribir en él'
);
select tests.salir();

select * from finish();
rollback;
