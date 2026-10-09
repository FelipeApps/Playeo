-- Fase 1: perfiles, registro con mayoría de edad confirmada y fotos de perfil.

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Esquema para funciones auxiliares. PostgREST no lo expone, así que nada de lo que
-- hay aquí se puede llamar desde la API; solo lo usan las políticas y los triggers.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.privacidad_perfil as enum ('publico', 'amigos');

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- citext: "Ana" y "ana" son el mismo usuario.
  nombre_usuario extensions.citext not null unique
    constraint nombre_usuario_formato check (nombre_usuario ~ '^[a-zA-Z0-9_.]{3,24}$'),
  nombre_visible text not null
    constraint nombre_visible_largo check (char_length(nombre_visible) between 1 and 50),
  -- Ruta dentro del bucket "avatares": <id de usuario>/<archivo>.
  ruta_foto text,
  isla text constraint isla_valida check (
    isla in (
      'Gran Canaria', 'Tenerife', 'Lanzarote', 'Fuerteventura',
      'La Palma', 'La Gomera', 'El Hierro', 'La Graciosa'
    )
  ),
  bio text constraint bio_corta check (char_length(bio) <= 160),
  -- Mismas claves que las preferencias locales de la app: plan, toleranciaViento, sensibleCalima.
  preferencias_playa jsonb not null default '{}'::jsonb,
  privacidad public.privacidad_perfil not null default 'publico',
  -- Solo se guarda cuándo declaró ser mayor de 18, no la fecha de nacimiento.
  -- Nulo únicamente en altas con proveedores externos que aún no lo han confirmado.
  mayoria_edad_confirmada timestamptz,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

comment on table public.perfiles is 'Perfil social de cada usuario. Lo crea un trigger al registrarse.';

-- Búsqueda de usuarios por fragmento del nombre ("ana" encuentra "mariana_92").
create index perfiles_nombre_usuario_trgm_idx
  on public.perfiles using gin ((nombre_usuario::text) extensions.gin_trgm_ops);

-- Mantiene la columna "actualizado" en cualquier tabla que la tenga.
create function private.marcar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado := now();
  return new;
end;
$$;

create trigger perfiles_actualizado
  before update on public.perfiles
  for each row execute function private.marcar_actualizado();

-- Crea el perfil al registrarse. Con email y contraseña, el alta falla si no se ha
-- confirmado la mayoría de edad. Los proveedores externos (Google, Apple) no envían
-- ese dato: el perfil se crea sin confirmar y la app lo pide antes de dejar continuar.
create function private.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  datos jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  proveedor text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  es_adulto boolean := coalesce((datos ->> 'mayor_de_edad')::boolean, false);
begin
  if proveedor = 'email' and not es_adulto then
    raise exception 'Hay que confirmar la mayoría de edad para registrarse'
      using errcode = 'check_violation';
  end if;

  insert into public.perfiles (id, nombre_usuario, nombre_visible, mayoria_edad_confirmada)
  values (
    new.id,
    coalesce(nullif(datos ->> 'nombre_usuario', ''), 'usuario_' || left(replace(new.id::text, '-', ''), 10)),
    coalesce(nullif(datos ->> 'nombre_visible', ''), nullif(datos ->> 'full_name', ''), 'Sin nombre'),
    case when es_adulto then now() end
  );
  return new;
end;
$$;

create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function private.crear_perfil();

-- Permisos: la app solo lee y edita. El alta la hace el trigger y la baja, el borrado
-- de la cuenta. Las columnas de identidad y de edad no se pueden modificar.
alter table public.perfiles enable row level security;

revoke all on public.perfiles from anon, authenticated;
grant select on public.perfiles to authenticated;
grant update (nombre_usuario, nombre_visible, ruta_foto, isla, bio, preferencias_playa, privacidad)
  on public.perfiles to authenticated;

-- En la fase 2 esta política se sustituye por otra que tiene en cuenta amigos y bloqueos.
create policy "Leer mi perfil y los públicos"
  on public.perfiles for select
  to authenticated
  using (id = (select auth.uid()) or privacidad = 'publico');

create policy "Editar solo mi perfil"
  on public.perfiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Para avisar en el formulario de registro antes de enviar. Los nombres de usuario
-- son públicos por naturaleza, así que puede consultarse sin sesión.
create function public.nombre_usuario_disponible(nombre text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Con search_path vacío hay que nombrar el operador de citext; el "=" a secas
  -- compararía como texto normal y distinguiría mayúsculas.
  select not exists (
    select 1 from public.perfiles
    where nombre_usuario operator(extensions.=) nombre::extensions.citext
  );
$$;

revoke all on function public.nombre_usuario_disponible(text) from public;
grant execute on function public.nombre_usuario_disponible(text) to anon, authenticated;

-- Confirmación de edad para altas con proveedores externos.
create function public.confirmar_mayoria_edad()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfiles
  set mayoria_edad_confirmada = now()
  where id = (select auth.uid()) and mayoria_edad_confirmada is null;
$$;

revoke all on function public.confirmar_mayoria_edad() from public, anon;
grant execute on function public.confirmar_mayoria_edad() to authenticated;

-- Exportación de datos (RGPD). Se amplía en cada fase con las tablas nuevas.
-- Sin security definer: solo devuelve lo que RLS deja ver al propio usuario.
create function public.exportar_mis_datos()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'exportado', now(),
    'correo', (select auth.jwt() ->> 'email'),
    'perfil', (select to_jsonb(p) from public.perfiles p where p.id = (select auth.uid()))
  );
$$;

revoke all on function public.exportar_mis_datos() from public, anon;
grant execute on function public.exportar_mis_datos() to authenticated;

-- Fotos de perfil. Bucket privado: se leen con sesión iniciada y cada usuario solo
-- escribe dentro de su carpeta (<id de usuario>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Ver fotos de perfil con sesión iniciada"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatares');

create policy "Subir fotos a mi carpeta"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Reemplazar fotos de mi carpeta"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Borrar fotos de mi carpeta"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
