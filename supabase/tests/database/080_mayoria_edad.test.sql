begin;
select plan(9);

delete from private.ajustes;

select tests.crear_usuario('ana');

-- Una cuenta creada con Google: sin datos del formulario ni confirmación de edad.
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'gus@prueba.test', '{"provider": "google"}', '{"full_name": "Gus de Google"}'
);
update public.perfiles set nombre_usuario = 'gus'
where id = (select id from auth.users where email = 'gus@prueba.test');
insert into public.lugares (id, nombre, region) values ('playa-de-prueba', 'Playa de prueba', 'zona-de-prueba');

select is(
  (select nombre_visible from public.perfiles where nombre_usuario = 'gus'),
  'Gus de Google',
  'Al entrar con Google se crea el perfil con el nombre de la cuenta'
);
select is(
  (select mayoria_edad_confirmada from public.perfiles where nombre_usuario = 'gus'),
  null,
  'Pero sin la mayoría de edad confirmada'
);

select tests.entrar_como('gus');
select throws_ok(
  $$ insert into public.amistades (solicitante_id, destinatario_id)
     values (tests.id_de('gus'), tests.id_de('ana')) $$,
  '42501',
  null,
  'Sin confirmar la edad no se pueden enviar solicitudes de amistad'
);
select throws_ok(
  $$ select public.crear_grupo('Grupo de Gus') $$,
  '42501',
  null,
  'Ni crear grupos'
);
select throws_ok(
  $$ insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad)
     values (tests.id_de('gus'), 'playa-de-prueba', 'Quedada', now() + interval '1 day', 'publico') $$,
  '42501',
  null,
  'Ni crear quedadas'
);
select is(
  (select count(*) from public.perfiles where nombre_usuario = 'gus'),
  1::bigint,
  'Sí puede ver su propio perfil, para poder confirmarla'
);

select lives_ok($$ select public.confirmar_mayoria_edad() $$, 'Confirma que es mayor de edad');
select lives_ok(
  $$ insert into public.amistades (solicitante_id, destinatario_id)
     values (tests.id_de('gus'), tests.id_de('ana')) $$,
  'Con la edad confirmada ya puede enviar solicitudes'
);
select lives_ok($$ select public.crear_grupo('Grupo de Gus') $$, 'Y crear grupos');
select tests.salir();

select * from finish();
rollback;
