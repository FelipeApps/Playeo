-- Fase 3: grupos, miembros con rol e invitaciones.

create type public.rol_grupo as enum ('admin', 'miembro');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null constraint nombre_grupo_largo check (char_length(nombre) between 3 and 50),
  descripcion text constraint descripcion_grupo_larga check (char_length(descripcion) <= 300),
  -- Si quien lo creó borra su cuenta, el grupo sigue con sus otros miembros.
  creado_por uuid references public.perfiles (id) on delete set null,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create index grupos_creado_por_idx on public.grupos (creado_por);

create trigger grupos_actualizado
  before update on public.grupos
  for each row execute function private.marcar_actualizado();

create table public.miembros_grupo (
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  rol public.rol_grupo not null default 'miembro',
  unido timestamptz not null default now(),
  primary key (grupo_id, usuario_id)
);

-- "Mis grupos": la clave primaria empieza por grupo, así que hace falta el otro lado.
create index miembros_grupo_usuario_idx on public.miembros_grupo (usuario_id);

-- Una fila es una invitación pendiente. Aceptarla la convierte en membresía y la borra;
-- rechazarla o cancelarla es borrarla.
create table public.invitaciones_grupo (
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  invitado_id uuid not null references public.perfiles (id) on delete cascade,
  invitador_id uuid not null references public.perfiles (id) on delete cascade,
  creada timestamptz not null default now(),
  primary key (grupo_id, invitado_id),
  constraint invitacion_a_otra_persona check (invitado_id <> invitador_id)
);

create index invitaciones_grupo_invitado_idx on public.invitaciones_grupo (invitado_id);
create index invitaciones_grupo_invitador_idx on public.invitaciones_grupo (invitador_id);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares para las políticas
-- ---------------------------------------------------------------------------
-- Las políticas de miembros_grupo necesitan consultar miembros_grupo; hacerlo dentro de
-- la propia política sería recursivo, así que la comprobación va en funciones definer.

create function private.soy_miembro_de(grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros_grupo
    where grupo_id = grupo and usuario_id = (select auth.uid())
  );
$$;

create function private.soy_admin_de(grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros_grupo
    where grupo_id = grupo and usuario_id = (select auth.uid()) and rol = 'admin'
  );
$$;

create function private.estoy_invitado_a(grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invitaciones_grupo
    where grupo_id = grupo and invitado_id = (select auth.uid())
  );
$$;

create function private.es_miembro_de(grupo uuid, usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros_grupo where grupo_id = grupo and usuario_id = usuario
  );
$$;

revoke all on function private.soy_miembro_de(uuid) from public, anon;
revoke all on function private.soy_admin_de(uuid) from public, anon;
revoke all on function private.estoy_invitado_a(uuid) from public, anon;
revoke all on function private.es_miembro_de(uuid, uuid) from public, anon;
grant execute on function private.soy_miembro_de(uuid) to authenticated;
grant execute on function private.soy_admin_de(uuid) to authenticated;
grant execute on function private.estoy_invitado_a(uuid) to authenticated;
grant execute on function private.es_miembro_de(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Un grupo no puede quedarse sin administrador ni vacío. Cuando alguien sale (o se le
-- expulsa, o borra su cuenta): si no queda nadie, el grupo se elimina; si no queda
-- ningún administrador, pasa a serlo el miembro más antiguo.
create function private.mantener_grupo_tras_salida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.miembros_grupo where grupo_id = old.grupo_id) then
    delete from public.grupos where id = old.grupo_id;
  elsif not exists (
    select 1 from public.miembros_grupo where grupo_id = old.grupo_id and rol = 'admin'
  ) then
    update public.miembros_grupo
    set rol = 'admin'
    where grupo_id = old.grupo_id
      and usuario_id = (
        select usuario_id from public.miembros_grupo
        where grupo_id = old.grupo_id
        order by unido, usuario_id
        limit 1
      );
  end if;
  return old;
end;
$$;

create trigger miembros_grupo_tras_salida
  after delete on public.miembros_grupo
  for each row execute function private.mantener_grupo_tras_salida();

-- El único administrador no puede quitarse el rol: antes tiene que nombrar a otro.
create function private.impedir_grupo_sin_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.rol = 'admin' and new.rol <> 'admin' and not exists (
    select 1 from public.miembros_grupo
    where grupo_id = old.grupo_id and rol = 'admin' and usuario_id <> old.usuario_id
  ) then
    raise exception 'El grupo necesita al menos un administrador'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger miembros_grupo_con_admin
  before update of rol on public.miembros_grupo
  for each row execute function private.impedir_grupo_sin_admin();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.grupos enable row level security;
alter table public.miembros_grupo enable row level security;
alter table public.invitaciones_grupo enable row level security;

revoke all on public.grupos, public.miembros_grupo, public.invitaciones_grupo
  from anon, authenticated;

-- Grupos. Se crean con crear_grupo(), que además da de alta al creador como
-- administrador; por eso no hay política de inserción.
grant select, delete on public.grupos to authenticated;
grant update (nombre, descripcion) on public.grupos to authenticated;

create policy "Ver los grupos a los que pertenezco o me han invitado"
  on public.grupos for select
  to authenticated
  using (
    (select private.soy_miembro_de(id)) or (select private.estoy_invitado_a(id))
  );

create policy "Solo los administradores editan el grupo"
  on public.grupos for update
  to authenticated
  using ((select private.soy_admin_de(id)))
  with check ((select private.soy_admin_de(id)));

create policy "Solo los administradores eliminan el grupo"
  on public.grupos for delete
  to authenticated
  using ((select private.soy_admin_de(id)));

-- Miembros. Nadie se añade a sí mismo: se entra aceptando una invitación.
grant select, delete on public.miembros_grupo to authenticated;
grant update (rol) on public.miembros_grupo to authenticated;

create policy "Ver a los miembros de mis grupos"
  on public.miembros_grupo for select
  to authenticated
  using ((select private.soy_miembro_de(grupo_id)));

create policy "Solo los administradores cambian roles"
  on public.miembros_grupo for update
  to authenticated
  using ((select private.soy_admin_de(grupo_id)))
  with check ((select private.soy_admin_de(grupo_id)));

create policy "Salir del grupo o, siendo administrador, expulsar"
  on public.miembros_grupo for delete
  to authenticated
  using (
    usuario_id = (select auth.uid()) or (select private.soy_admin_de(grupo_id))
  );

-- Invitaciones
grant select, insert, delete on public.invitaciones_grupo to authenticated;

create policy "Ver las invitaciones que envío, recibo o administro"
  on public.invitaciones_grupo for select
  to authenticated
  using (
    invitado_id = (select auth.uid())
    or invitador_id = (select auth.uid())
    or (select private.soy_admin_de(grupo_id))
  );

create policy "Un miembro invita a un amigo suyo que aún no está en el grupo"
  on public.invitaciones_grupo for insert
  to authenticated
  with check (
    invitador_id = (select auth.uid())
    and (select private.soy_miembro_de(grupo_id))
    and (select private.es_mi_amigo(invitado_id))
    and not (select private.hay_bloqueo_con(invitado_id))
    and not (select private.es_miembro_de(grupo_id, invitado_id))
  );

create policy "Rechazar, cancelar o retirar una invitación"
  on public.invitaciones_grupo for delete
  to authenticated
  using (
    invitado_id = (select auth.uid())
    or invitador_id = (select auth.uid())
    or (select private.soy_admin_de(grupo_id))
  );

-- ---------------------------------------------------------------------------
-- Funciones para la app
-- ---------------------------------------------------------------------------

create function public.crear_grupo(nombre text, descripcion text default null)
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

  insert into public.grupos (nombre, descripcion, creado_por)
  values (trim(nombre), nullif(trim(descripcion), ''), yo)
  returning id into nuevo;

  insert into public.miembros_grupo (grupo_id, usuario_id, rol) values (nuevo, yo, 'admin');
  return nuevo;
end;
$$;

create function public.aceptar_invitacion_grupo(grupo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
begin
  delete from public.invitaciones_grupo where grupo_id = grupo and invitado_id = yo;
  if not found then
    raise exception 'No tienes una invitación a este grupo' using errcode = 'insufficient_privilege';
  end if;

  insert into public.miembros_grupo (grupo_id, usuario_id)
  values (grupo, yo)
  on conflict do nothing;
end;
$$;

-- Mis grupos con el número de miembros y mi rol. Sin definer: RLS ya limita a los míos.
create function public.mis_grupos()
returns table (id uuid, nombre text, descripcion text, miembros bigint, mi_rol public.rol_grupo)
language sql
stable
set search_path = ''
as $$
  select
    g.id,
    g.nombre,
    g.descripcion,
    (select count(*) from public.miembros_grupo m where m.grupo_id = g.id),
    yo.rol
  from public.grupos g
  join public.miembros_grupo yo on yo.grupo_id = g.id and yo.usuario_id = (select auth.uid())
  order by g.nombre;
$$;

-- Miembros de un grupo con su tarjeta. Definer porque un compañero de grupo puede tener
-- el perfil "solo amigos" y aun así hay que poder mostrar quién es.
create function public.miembros_de_grupo(grupo uuid)
returns table (
  id uuid,
  nombre_usuario text,
  nombre_visible text,
  ruta_foto text,
  rol public.rol_grupo,
  unido timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nombre_usuario::text, p.nombre_visible, p.ruta_foto, m.rol, m.unido
  from public.miembros_grupo m
  join public.perfiles p on p.id = m.usuario_id
  where m.grupo_id = grupo
    and private.soy_miembro_de(grupo)
  order by (m.rol = 'admin') desc, p.nombre_visible;
$$;

-- Invitaciones que he recibido, con el nombre del grupo y quién invita.
create function public.mis_invitaciones_grupo()
returns table (
  grupo_id uuid,
  grupo_nombre text,
  grupo_descripcion text,
  invitador_nombre text,
  creada timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.nombre, g.descripcion, p.nombre_visible, i.creada
  from public.invitaciones_grupo i
  join public.grupos g on g.id = i.grupo_id
  join public.perfiles p on p.id = i.invitador_id
  where i.invitado_id = (select auth.uid())
  order by i.creada desc;
$$;

-- Amigos a los que puedo invitar: ni son miembros ni tienen ya una invitación.
create function public.amigos_invitables(grupo uuid)
returns table (id uuid, nombre_usuario text, nombre_visible text, ruta_foto text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nombre_usuario::text, p.nombre_visible, p.ruta_foto
  from public.amistades a
  join public.perfiles p
    on p.id = case
      when a.solicitante_id = (select auth.uid()) then a.destinatario_id
      else a.solicitante_id
    end
  where a.estado = 'aceptada'
    and (a.solicitante_id = (select auth.uid()) or a.destinatario_id = (select auth.uid()))
    and private.soy_miembro_de(grupo)
    and not exists (
      select 1 from public.miembros_grupo m where m.grupo_id = grupo and m.usuario_id = p.id
    )
    and not exists (
      select 1 from public.invitaciones_grupo i where i.grupo_id = grupo and i.invitado_id = p.id
    )
  order by p.nombre_visible;
$$;

revoke all on function public.crear_grupo(text, text) from public, anon;
revoke all on function public.aceptar_invitacion_grupo(uuid) from public, anon;
revoke all on function public.mis_grupos() from public, anon;
revoke all on function public.miembros_de_grupo(uuid) from public, anon;
revoke all on function public.mis_invitaciones_grupo() from public, anon;
revoke all on function public.amigos_invitables(uuid) from public, anon;
grant execute on function public.crear_grupo(text, text) to authenticated;
grant execute on function public.aceptar_invitacion_grupo(uuid) to authenticated;
grant execute on function public.mis_grupos() to authenticated;
grant execute on function public.miembros_de_grupo(uuid) to authenticated;
grant execute on function public.mis_invitaciones_grupo() to authenticated;
grant execute on function public.amigos_invitables(uuid) to authenticated;

-- Exportación de datos: se añaden los grupos a los que pertenezco.
create or replace function public.exportar_mis_datos()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'exportado', now(),
    'correo', (select auth.jwt() ->> 'email'),
    'perfil', (select to_jsonb(p) from public.perfiles p where p.id = (select auth.uid())),
    'amistades', coalesce((select jsonb_agg(to_jsonb(a)) from public.amistades a), '[]'::jsonb),
    'bloqueos', coalesce((select jsonb_agg(to_jsonb(b)) from public.bloqueos b), '[]'::jsonb),
    'reportes_enviados', coalesce((select jsonb_agg(to_jsonb(r)) from public.reportes r), '[]'::jsonb),
    'grupos', coalesce((select jsonb_agg(to_jsonb(g)) from public.mis_grupos() g), '[]'::jsonb)
  );
$$;
