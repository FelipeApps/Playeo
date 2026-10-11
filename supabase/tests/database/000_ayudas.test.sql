-- Ayudas para los tests de RLS. Este archivo se ejecuta el primero (orden alfabético)
-- y no va en una transacción, para que las funciones queden disponibles para el resto.

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Crea un usuario como lo haría el registro con email, con la edad confirmada.
create or replace function tests.crear_usuario(nombre text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  nuevo uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (
    nuevo,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    nombre || '@prueba.test',
    '{"provider": "email"}'::jsonb,
    jsonb_build_object('nombre_usuario', nombre, 'nombre_visible', initcap(nombre), 'mayor_de_edad', true, 'condiciones_version', '2026-10')
  );
  return nuevo;
end;
$$;

create or replace function tests.id_de(nombre text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id from public.perfiles where nombre_usuario operator(extensions.=) nombre::extensions.citext;
$$;

-- A partir de aquí las consultas se ejecutan como ese usuario, con RLS aplicado.
create or replace function tests.entrar_como(nombre text)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', tests.id_de(nombre), 'role', 'authenticated', 'email', nombre || '@prueba.test')::text,
    true
  );
end;
$$;

create or replace function tests.entrar_como_anonimo()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end;
$$;

-- Vuelve al superusuario para preparar datos entre comprobaciones.
create or replace function tests.salir()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select pass('Ayudas de test instaladas');
select * from finish();
