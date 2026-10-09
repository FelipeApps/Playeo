begin;
select plan(13);

-- Registro
select throws_ok(
  $$ insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), 'menor@prueba.test', '{"provider": "email"}',
             '{"nombre_usuario": "menor", "nombre_visible": "Menor"}') $$,
  '23514',
  null,
  'El registro con email falla si no se confirma la mayoría de edad'
);

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');
update public.perfiles set privacidad = 'amigos' where nombre_usuario = 'beto';

select is(
  (select count(*) from public.perfiles where nombre_usuario in ('ana', 'beto')),
  2::bigint,
  'El trigger crea un perfil por cada usuario registrado'
);
select isnt(
  (select mayoria_edad_confirmada from public.perfiles where nombre_usuario = 'ana'),
  null,
  'Queda guardado cuándo se confirmó la mayoría de edad'
);
select throws_ok(
  $$ select tests.crear_usuario('ANA') $$,
  '23505',
  null,
  'El nombre de usuario es único sin distinguir mayúsculas'
);

-- Sin sesión
select tests.entrar_como_anonimo();
select throws_ok(
  $$ select * from public.perfiles $$,
  '42501',
  null,
  'Sin sesión no se puede leer ningún perfil'
);
select is(public.nombre_usuario_disponible('ana'), false, 'Sin sesión se puede saber si un nombre está cogido');
select is(public.nombre_usuario_disponible('ANA'), false, 'La disponibilidad no distingue mayúsculas');
select tests.salir();

-- Como Ana
select tests.entrar_como('ana');
select is(
  (select count(*) from public.perfiles where nombre_usuario = 'ana'),
  1::bigint,
  'Ana ve su propio perfil'
);
select is(
  (select count(*) from public.perfiles where nombre_usuario = 'beto'),
  0::bigint,
  'Ana no ve el perfil "solo amigos" de Beto'
);

update public.perfiles set bio = 'Hackeado' where nombre_usuario = 'beto';
select tests.salir();
select is(
  (select bio from public.perfiles where nombre_usuario = 'beto'),
  null,
  'Ana no puede editar el perfil de Beto'
);

select tests.entrar_como('ana');
select throws_ok(
  $$ update public.perfiles set mayoria_edad_confirmada = null where id = tests.id_de('ana') $$,
  '42501',
  null,
  'Nadie puede modificar su confirmación de edad'
);
select throws_ok(
  $$ insert into public.perfiles (id, nombre_usuario, nombre_visible)
     values (gen_random_uuid(), 'falso', 'Falso') $$,
  '42501',
  null,
  'No se pueden crear perfiles a mano'
);
select throws_ok(
  $$ delete from public.perfiles where id = tests.id_de('ana') $$,
  '42501',
  null,
  'No se pueden borrar perfiles desde la app'
);
select tests.salir();

select * from finish();
rollback;
