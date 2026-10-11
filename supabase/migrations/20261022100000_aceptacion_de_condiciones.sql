-- Aceptación de los Términos de uso y las Normas de la comunidad. Se guarda cuándo se
-- aceptaron y qué versión, para poder demostrarlo y para volver a pedirlo si cambian.

alter table public.perfiles
  add column condiciones_aceptadas timestamptz,
  add column condiciones_version text
    constraint version_de_condiciones_valida check (condiciones_version ~ '^[0-9]{4}-[0-9]{2}$'),
  add constraint condiciones_con_su_version check (
    (condiciones_aceptadas is null) = (condiciones_version is null)
  );

-- El alta con email y contraseña exige, además de la mayoría de edad, haber aceptado las
-- condiciones. Los proveedores externos (Google, Apple) no pasan por el formulario: su
-- perfil nace sin aceptar y la app lo pide antes de dejar continuar.
create or replace function private.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  datos jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  proveedor text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  es_adulto boolean := coalesce((datos ->> 'mayor_de_edad')::boolean, false);
  version text := nullif(datos ->> 'condiciones_version', '');
begin
  if proveedor = 'email' and not es_adulto then
    raise exception 'Hay que confirmar la mayoría de edad para registrarse'
      using errcode = 'check_violation';
  end if;
  if proveedor = 'email' and version is null then
    raise exception 'Hay que aceptar los Términos de uso para registrarse'
      using errcode = 'check_violation';
  end if;

  insert into public.perfiles (
    id, nombre_usuario, nombre_visible, mayoria_edad_confirmada,
    condiciones_aceptadas, condiciones_version
  )
  values (
    new.id,
    coalesce(nullif(datos ->> 'nombre_usuario', ''), 'usuario_' || left(replace(new.id::text, '-', ''), 10)),
    coalesce(nullif(datos ->> 'nombre_visible', ''), nullif(datos ->> 'full_name', ''), 'Sin nombre'),
    case when es_adulto then now() end,
    case when version is not null then now() end,
    version
  );
  return new;
end;
$$;

-- Para quien entró sin pasar por el formulario, o cuando se publique una versión nueva.
-- La fecha la pone el servidor; la app solo dice qué versión ha enseñado.
create function public.aceptar_condiciones(version text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfiles
  set condiciones_aceptadas = now(), condiciones_version = version
  where id = (select auth.uid())
    and condiciones_version is distinct from version;
$$;

revoke all on function public.aceptar_condiciones(text) from public, anon;
grant execute on function public.aceptar_condiciones(text) to authenticated;
