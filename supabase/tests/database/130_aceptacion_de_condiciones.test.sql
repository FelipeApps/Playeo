begin;
select plan(9);

-- -------------------------------------------------------------------- Alta
select throws_ok(
  $$ insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             'sin-condiciones@prueba.test', '{"provider": "email"}',
             '{"nombre_usuario": "sin_condiciones", "nombre_visible": "Sin", "mayor_de_edad": true}') $$,
  '23514',
  null,
  'No se puede registrar con email sin aceptar las condiciones'
);

select tests.crear_usuario('ana');
select isnt(
  (select condiciones_aceptadas from public.perfiles where id = tests.id_de('ana')),
  null,
  'Al registrarse aceptándolas queda guardado cuándo'
);
select is(
  (select condiciones_version from public.perfiles where id = tests.id_de('ana')),
  '2026-10',
  'Y qué versión se aceptó'
);

-- ------------------------------------------------- Quien entra con Google
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'gala@prueba.test', '{"provider": "google"}', '{"nombre_usuario": "gala", "full_name": "Gala"}');
select is(
  (select condiciones_aceptadas from public.perfiles where id = tests.id_de('gala')),
  null,
  'Una cuenta de Google nace sin las condiciones aceptadas'
);

select tests.entrar_como('gala');
select throws_ok(
  $$ update public.perfiles set condiciones_aceptadas = '2000-01-01', condiciones_version = '2000-01'
     where id = tests.id_de('gala') $$,
  '42501',
  null,
  'La app no puede escribir la aceptación directamente ni falsear la fecha'
);
select lives_ok(
  $$ select public.aceptar_condiciones('2026-10') $$,
  'Gala acepta las condiciones desde la app'
);
select tests.salir();
select is(
  (select condiciones_version from public.perfiles where id = tests.id_de('gala')),
  '2026-10',
  'Queda guardada la versión que aceptó'
);
select is(
  (select condiciones_aceptadas from public.perfiles where id = tests.id_de('ana'))
    = (select condiciones_aceptadas from public.perfiles where id = tests.id_de('ana')),
  true,
  'Aceptar no toca la aceptación de otras personas'
);

-- ------------------------------------------------------------ Versión nueva
update public.perfiles set condiciones_aceptadas = '2026-01-01' where id = tests.id_de('gala');
select tests.entrar_como('gala');
select public.aceptar_condiciones('2026-10');
select public.aceptar_condiciones('2027-03');
select tests.salir();
select is(
  (select condiciones_version || ' ' || (condiciones_aceptadas > '2026-06-01')::text
   from public.perfiles where id = tests.id_de('gala')),
  '2027-03 true',
  'Repetir la misma versión no cambia la fecha; una versión nueva la renueva'
);

select * from finish();
rollback;
