-- Con el inicio de sesión de Google activo, una cuenta puede existir sin haber confirmado
-- la mayoría de edad (Google no pasa por el formulario de registro). Hasta ahora eso solo
-- lo frenaba la app; aquí pasa a garantizarlo la base de datos: sin confirmación no se
-- puede hacer nada social.

create function private.soy_adulto()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and mayoria_edad_confirmada is not null
  );
$$;

revoke all on function private.soy_adulto() from public, anon;
grant execute on function private.soy_adulto() to authenticated;

-- Políticas restrictivas: se suman con "Y" a las que ya existen. No dan ningún permiso
-- nuevo; solo exigen, además, la confirmación de edad para crear cualquier cosa.
create policy "Solo con la mayoría de edad confirmada"
  on public.amistades as restrictive for insert to authenticated
  with check ((select private.soy_adulto()));

create policy "Solo con la mayoría de edad confirmada"
  on public.mensajes as restrictive for insert to authenticated
  with check ((select private.soy_adulto()));

create policy "Solo con la mayoría de edad confirmada"
  on public.eventos as restrictive for insert to authenticated
  with check ((select private.soy_adulto()));

create policy "Solo con la mayoría de edad confirmada"
  on public.asistencias_evento as restrictive for insert to authenticated
  with check ((select private.soy_adulto()));

create policy "Solo con la mayoría de edad confirmada"
  on public.invitaciones_grupo as restrictive for insert to authenticated
  with check ((select private.soy_adulto()));

create policy "Solo con la mayoría de edad confirmada"
  on public.invitaciones_evento as restrictive for insert to authenticated
  with check ((select private.soy_adulto()));

-- Las funciones definer se saltan RLS, así que la comprobación va dentro de ellas.
create or replace function public.crear_grupo(nombre text, descripcion text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  nuevo uuid;
begin
  if yo is null then
    raise exception 'Hay que iniciar sesión' using errcode = 'insufficient_privilege';
  end if;
  if not private.soy_adulto() then
    raise exception 'Hay que confirmar la mayoría de edad' using errcode = 'insufficient_privilege';
  end if;

  insert into public.grupos (nombre, descripcion, creado_por)
  values (trim(nombre), nullif(trim(descripcion), ''), yo)
  returning id into nuevo;

  insert into public.miembros_grupo (grupo_id, usuario_id, rol) values (nuevo, yo, 'admin');
  return nuevo;
end;
$$;

create or replace function public.aceptar_invitacion_grupo(grupo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
begin
  if not private.soy_adulto() then
    raise exception 'Hay que confirmar la mayoría de edad' using errcode = 'insufficient_privilege';
  end if;

  delete from public.invitaciones_grupo where grupo_id = grupo and invitado_id = yo;
  if not found then
    raise exception 'No tienes una invitación a este grupo' using errcode = 'insufficient_privilege';
  end if;

  insert into public.miembros_grupo (grupo_id, usuario_id)
  values (grupo, yo)
  on conflict do nothing;
end;
$$;
