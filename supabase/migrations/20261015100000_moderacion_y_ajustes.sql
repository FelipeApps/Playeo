-- Cierra huecos de las fases anteriores: moderación de reportes, bloqueos en las fotos
-- de perfil y el enlace de WhatsApp de una quedada para quien la organiza.

-- ---------------------------------------------------------------------------
-- Moderación
-- ---------------------------------------------------------------------------

-- Quién puede revisar reportes. No hay forma de entrar aquí desde la app: se añade a
-- mano desde el panel de Supabase, con
--   insert into private.moderadores (usuario_id) values ('<id del usuario>');
create table private.moderadores (
  usuario_id uuid primary key references public.perfiles (id) on delete cascade,
  desde timestamptz not null default now()
);

alter table private.moderadores enable row level security;
revoke all on private.moderadores from public, anon, authenticated;
comment on table private.moderadores is
  'Moderadores. RLS activado sin políticas a propósito: solo se gestiona con la clave de servicio.';

create function private.soy_moderador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.moderadores where usuario_id = (select auth.uid())
  );
$$;

revoke all on function private.soy_moderador() from public, anon;
grant execute on function private.soy_moderador() to authenticated;

-- Para que la app sepa si debe enseñar la sección de moderación.
create function public.soy_moderador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.soy_moderador();
$$;

-- Los moderadores ven todos los reportes y cambian su estado. Estas políticas se suman
-- a las de la fase 2: quien reporta sigue viendo solo lo suyo.
grant update (estado) on public.reportes to authenticated;

create policy "Los moderadores ven todos los reportes"
  on public.reportes for select
  to authenticated
  using ((select private.soy_moderador()));

create policy "Los moderadores cambian el estado de los reportes"
  on public.reportes for update
  to authenticated
  using ((select private.soy_moderador()))
  with check ((select private.soy_moderador()));

-- Cola de moderación con lo necesario para decidir: quién reporta, a quién y qué mensaje.
create function public.reportes_para_moderar(solo_abiertos boolean default true)
returns table (
  id bigint,
  estado public.estado_reporte,
  motivo public.motivo_reporte,
  detalles text,
  contenido text,
  mensaje_id bigint,
  mensaje_existe boolean,
  reportante_nombre text,
  reportado_id uuid,
  reportado_nombre text,
  reportado_usuario text,
  reportes_previos bigint,
  creado timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.estado,
    r.motivo,
    r.detalles,
    r.contenido,
    r.mensaje_id,
    exists (select 1 from public.mensajes m where m.id = r.mensaje_id),
    quien.nombre_visible,
    a_quien.id,
    a_quien.nombre_visible,
    a_quien.nombre_usuario::text,
    -- Cuántas veces más han reportado a esta persona: ayuda a ver patrones.
    (
      select count(*) from public.reportes otros
      where otros.usuario_reportado_id = r.usuario_reportado_id and otros.id <> r.id
    ),
    r.creado
  from public.reportes r
  left join public.perfiles quien on quien.id = r.reportante_id
  left join public.perfiles a_quien on a_quien.id = r.usuario_reportado_id
  where private.soy_moderador()
    and (not solo_abiertos or r.estado = 'abierto')
  order by r.creado
  limit 200;
$$;

-- Retira el mensaje de un reporte y lo deja revisado. Es la única acción de moderación
-- que toca contenido de otros usuarios.
create function public.moderar_borrar_mensaje(reporte bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.soy_moderador() then
    raise exception 'Solo para moderación' using errcode = 'insufficient_privilege';
  end if;

  delete from public.mensajes
  where id = (select mensaje_id from public.reportes where id = reporte);
  update public.reportes set estado = 'revisado' where id = reporte;
end;
$$;

revoke all on function public.soy_moderador() from public, anon;
revoke all on function public.reportes_para_moderar(boolean) from public, anon;
revoke all on function public.moderar_borrar_mensaje(bigint) from public, anon;
grant execute on function public.soy_moderador() to authenticated;
grant execute on function public.reportes_para_moderar(boolean) to authenticated;
grant execute on function public.moderar_borrar_mensaje(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Fotos de perfil: los bloqueos también valen aquí
-- ---------------------------------------------------------------------------
-- Hasta ahora cualquier usuario registrado podía descargar una foto si conocía su ruta.
-- La carpeta de cada foto es el id de su dueño, así que basta con mirar si hay bloqueo.

create function private.puedo_ver_foto_de(carpeta text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return not private.hay_bloqueo_con(carpeta::uuid);
exception when others then
  -- Una carpeta que no es un id de usuario no es una foto de perfil válida.
  return false;
end;
$$;

revoke all on function private.puedo_ver_foto_de(text) from public, anon;
grant execute on function private.puedo_ver_foto_de(text) to authenticated;

drop policy "Ver fotos de perfil con sesión iniciada" on storage.objects;

create policy "Ver fotos de perfil, salvo con bloqueo"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatares'
    and (select private.puedo_ver_foto_de((storage.foldername(name))[1]))
  );

-- ---------------------------------------------------------------------------
-- Quedadas: quien organiza ve siempre su enlace de WhatsApp
-- ---------------------------------------------------------------------------
-- Antes solo lo veía quien iba o quizá iba; si quien organiza marcaba "no voy", dejaba
-- de verlo y al editar la quedada se habría perdido.

create or replace function public.detalle_evento(evento uuid)
returns table (
  id uuid,
  titulo text,
  descripcion text,
  empieza timestamptz,
  playa_id text,
  playa_nombre text,
  visibilidad public.visibilidad_evento,
  grupo_id uuid,
  grupo_nombre text,
  creador_id uuid,
  creador_nombre text,
  creador_usuario text,
  creador_foto text,
  plazas_maximas integer,
  van bigint,
  mi_respuesta public.respuesta_evento,
  me_han_invitado boolean,
  enlace_whatsapp text,
  conversacion_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.titulo,
    e.descripcion,
    e.empieza,
    e.playa_id,
    p.nombre,
    e.visibilidad,
    e.grupo_id,
    g.nombre,
    e.creador_id,
    c.nombre_visible,
    c.nombre_usuario::text,
    c.ruta_foto,
    e.plazas_maximas,
    (select count(*) from public.asistencias_evento a where a.evento_id = e.id and a.respuesta = 'voy'),
    yo.respuesta,
    private.estoy_invitado_a_evento(e.id),
    case
      when yo.respuesta in ('voy', 'quiza') or e.creador_id = (select auth.uid())
      then e.enlace_whatsapp
    end,
    case when yo.respuesta in ('voy', 'quiza') then cv.id end
  from public.eventos e
  join public.playas p on p.id = e.playa_id
  join public.perfiles c on c.id = e.creador_id
  left join public.grupos g on g.id = e.grupo_id
  left join public.conversaciones cv on cv.evento_id = e.id
  left join public.asistencias_evento yo
    on yo.evento_id = e.id and yo.usuario_id = (select auth.uid())
  where e.id = evento
    and (select auth.uid()) is not null
    and private.puedo_ver_evento(e.id);
$$;
