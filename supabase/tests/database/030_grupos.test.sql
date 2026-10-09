begin;
select plan(24);

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');
select tests.crear_usuario('carla');
select tests.crear_usuario('dani');

-- Ana es amiga de Beto y de Dani. Carla no es amiga de nadie.
insert into public.amistades (solicitante_id, destinatario_id, estado) values
  (tests.id_de('ana'), tests.id_de('beto'), 'aceptada'),
  (tests.id_de('ana'), tests.id_de('dani'), 'aceptada');

create temp table contexto (grupo uuid);
grant all on contexto to authenticated;

-- ------------------------------------------------------------------- Creación
select tests.entrar_como('ana');
insert into contexto select public.crear_grupo('Surferos del norte', 'Para quedar en El Confital');
select is(
  (select rol from public.miembros_grupo where usuario_id = tests.id_de('ana')),
  'admin'::public.rol_grupo,
  'Quien crea el grupo queda como administradora'
);
select throws_ok(
  $$ insert into public.grupos (nombre) values ('Grupo a mano') $$,
  '42501',
  null,
  'No se pueden crear grupos sin pasar por crear_grupo()'
);

-- ---------------------------------------------------------- Desde fuera
select tests.entrar_como('carla');
select is((select count(*) from public.grupos), 0::bigint, 'Quien no es miembro no ve el grupo');
select is(
  (select count(*) from public.miembros_grupo),
  0::bigint,
  'Quien no es miembro no ve a los miembros'
);
select is(
  (select count(*) from public.miembros_de_grupo((select grupo from contexto))),
  0::bigint,
  'Tampoco los ve a través de la función de miembros'
);
select throws_ok(
  $$ insert into public.miembros_grupo (grupo_id, usuario_id)
     values ((select grupo from contexto), tests.id_de('carla')) $$,
  '42501',
  null,
  'Nadie puede añadirse a un grupo por su cuenta'
);
select throws_ok(
  $$ select public.aceptar_invitacion_grupo((select grupo from contexto)) $$,
  '42501',
  null,
  'No se puede aceptar una invitación que no existe'
);

-- --------------------------------------------------------------- Invitaciones
select tests.entrar_como('ana');
select lives_ok(
  $$ insert into public.invitaciones_grupo (grupo_id, invitado_id, invitador_id)
     values ((select grupo from contexto), tests.id_de('beto'), tests.id_de('ana')) $$,
  'Ana invita a su amigo Beto'
);
select throws_ok(
  $$ insert into public.invitaciones_grupo (grupo_id, invitado_id, invitador_id)
     values ((select grupo from contexto), tests.id_de('carla'), tests.id_de('ana')) $$,
  '42501',
  null,
  'No se puede invitar a quien no es amigo'
);
select is(
  (select count(*) from public.amigos_invitables((select grupo from contexto))),
  1::bigint,
  'Tras invitar a Beto, a Ana solo le queda Dani por invitar'
);

select tests.entrar_como('carla');
select throws_ok(
  $$ insert into public.invitaciones_grupo (grupo_id, invitado_id, invitador_id)
     values ((select grupo from contexto), tests.id_de('dani'), tests.id_de('carla')) $$,
  '42501',
  null,
  'Quien no es miembro no puede invitar'
);

select tests.entrar_como('beto');
select is(
  (select count(*) from public.grupos),
  1::bigint,
  'El invitado ve el grupo al que le han invitado'
);
select is(
  (select count(*) from public.miembros_grupo),
  0::bigint,
  'Pero aún no ve a sus miembros'
);
select lives_ok(
  $$ select public.aceptar_invitacion_grupo((select grupo from contexto)) $$,
  'Beto acepta la invitación'
);
select is(
  (select count(*) from public.miembros_grupo),
  2::bigint,
  'Ya miembro, Beto ve a los dos miembros'
);

-- ---------------------------------------------------- Permisos de un miembro
delete from public.miembros_grupo where usuario_id = tests.id_de('ana');
update public.miembros_grupo set rol = 'admin' where usuario_id = tests.id_de('beto');
update public.grupos set nombre = 'Renombrado por Beto';
select tests.salir();
select is(
  (select count(*) from public.miembros_grupo where usuario_id = tests.id_de('ana')),
  1::bigint,
  'Un miembro sin rol de administrador no puede expulsar'
);
select is(
  (select rol from public.miembros_grupo where usuario_id = tests.id_de('beto')),
  'miembro'::public.rol_grupo,
  'Ni puede nombrarse administrador'
);
select is(
  (select nombre from public.grupos where id = (select grupo from contexto)),
  'Surferos del norte',
  'Ni puede renombrar el grupo'
);

-- --------------------------------------------------- Permisos de la admin
select tests.entrar_como('ana');
select throws_ok(
  $$ update public.miembros_grupo set rol = 'miembro' where usuario_id = tests.id_de('ana') $$,
  '23514',
  null,
  'La única administradora no puede quitarse el rol'
);
delete from public.miembros_grupo where usuario_id = tests.id_de('beto');
select is(
  (select count(*) from public.miembros_grupo),
  1::bigint,
  'La administradora puede expulsar a un miembro'
);

-- ------------------------------------------- El grupo nunca queda sin admin
select tests.salir();
insert into public.miembros_grupo (grupo_id, usuario_id) values
  ((select grupo from contexto), tests.id_de('beto'));
select tests.entrar_como('ana');
delete from public.miembros_grupo where usuario_id = tests.id_de('ana');
select tests.salir();
select is(
  (select rol from public.miembros_grupo where usuario_id = tests.id_de('beto')),
  'admin'::public.rol_grupo,
  'Si la única administradora sale, hereda el rol el miembro más antiguo'
);
select tests.entrar_como('beto');
delete from public.miembros_grupo where usuario_id = tests.id_de('beto');
select tests.salir();
select is(
  (select count(*) from public.grupos where id = (select grupo from contexto)),
  0::bigint,
  'Cuando sale el último miembro, el grupo se elimina'
);

-- ------------------------------------------------------------------ Sin sesión
select tests.entrar_como_anonimo();
select throws_ok($$ select * from public.grupos $$, '42501', null, 'Sin sesión no se leen grupos');
select throws_ok(
  $$ select public.crear_grupo('Anónimo') $$,
  '42501',
  null,
  'Sin sesión no se pueden crear grupos'
);
select tests.salir();

select * from finish();
rollback;
