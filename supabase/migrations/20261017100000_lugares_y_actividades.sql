-- Planeo deja de ser solo de playas: una quedada es una ACTIVIDAD en un LUGAR.
--  - El catálogo de playas pasa a ser un catálogo de lugares (playas, rutas y canchas).
--  - Cada quedada tiene una actividad, y su sitio es un lugar del catálogo o una
--    ubicación escrita a mano (baile, pilates, otros).
-- Esta migración solo generaliza el modelo: las playas y las quedadas que ya existen
-- siguen funcionando igual. Rutas y canchas se cargan en una migración posterior.

-- ---------------------------------------------------------------------------
-- Actividades
-- ---------------------------------------------------------------------------

-- De qué tipo es el sitio de una actividad:
--  - catalogo_con_estado: se elige un lugar del catálogo y se muestra su previsión
--    (playa, senderismo).
--  - catalogo: se elige un lugar del catálogo, sin previsión (canchas).
--  - manual: quien organiza escribe el sitio.
create type public.tipo_sitio as enum ('catalogo_con_estado', 'catalogo', 'manual');

create table public.actividades (
  id text primary key constraint actividad_id_formato check (id ~ '^[a-z_]{2,30}$'),
  nombre text not null,
  tipo_sitio public.tipo_sitio not null,
  orden smallint not null
);

insert into public.actividades (id, nombre, tipo_sitio, orden) values
  ('playa', 'Playa', 'catalogo_con_estado', 1),
  ('senderismo', 'Senderismo', 'catalogo_con_estado', 2),
  ('futbol', 'Fútbol', 'catalogo', 3),
  ('baloncesto', 'Baloncesto', 'catalogo', 4),
  ('padel', 'Pádel', 'catalogo', 5),
  ('baile', 'Baile', 'manual', 6),
  ('pilates', 'Pilates', 'manual', 7),
  ('otros', 'Otros', 'manual', 8);

alter table public.actividades enable row level security;
revoke all on public.actividades from anon, authenticated;
-- El catálogo es público: Explorar funciona sin iniciar sesión, igual que el ranking.
grant select on public.actividades to anon, authenticated;

create policy "El catálogo de actividades es de lectura pública"
  on public.actividades for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Lugares (antes: playas)
-- ---------------------------------------------------------------------------

create type public.tipo_lugar as enum ('playa', 'ruta', 'cancha');

alter table public.playas rename to lugares;
alter index public.playas_pkey rename to lugares_pkey;
alter index public.playas_region_idx rename to lugares_region_idx;

alter table public.lugares
  add column tipo public.tipo_lugar not null default 'playa',
  add column actividad_id text not null default 'playa' references public.actividades (id),
  -- Punto del lugar: la orilla, el inicio de la ruta o la cancha. Nulo en las playas
  -- cargadas antes de esta migración (sus coordenadas viven en la app).
  add column lat double precision constraint lat_valida check (lat between -90 and 90),
  add column lon double precision constraint lon_valida check (lon between -180 and 180),
  -- Datos propios de cada tipo: distancia y desnivel de una ruta, superficie de una cancha...
  add column datos jsonb not null default '{}'::jsonb;

-- Explorar pide "los lugares de esta actividad en esta zona".
create index lugares_actividad_region_idx on public.lugares (actividad_id, region);

drop policy "El catálogo de playas lo lee cualquier usuario registrado" on public.lugares;
grant select on public.lugares to anon;

create policy "El catálogo de lugares es de lectura pública"
  on public.lugares for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Quedadas: actividad, lugar opcional y ubicación a mano
-- ---------------------------------------------------------------------------

alter table public.eventos rename column playa_id to lugar_id;
alter table public.eventos rename constraint eventos_playa_id_fkey to eventos_lugar_id_fkey;
alter index public.eventos_playa_fecha_idx rename to eventos_lugar_fecha_idx;

alter table public.eventos
  alter column lugar_id drop not null,
  add column actividad_id text not null default 'playa' references public.actividades (id),
  -- Solo con la actividad "otros": qué se va a hacer.
  add column actividad_otra text
    constraint actividad_otra_larga check (char_length(actividad_otra) between 2 and 60),
  -- Sitio escrito a mano, cuando no es un lugar del catálogo.
  add column ubicacion_nombre text
    constraint ubicacion_nombre_largo check (char_length(ubicacion_nombre) between 2 and 120),
  -- Dirección exacta. Puede ser un domicilio: solo la ve quien se apunta (ver abajo).
  add column ubicacion_direccion text
    constraint ubicacion_direccion_larga check (char_length(ubicacion_direccion) <= 300),
  -- Zona de costa de la quedada, para "quedadas en tu zona". Con lugar de catálogo se
  -- copia del lugar; con ubicación a mano la indica quien organiza.
  add column region text constraint region_formato check (region ~ '^[a-z0-9-]{2,40}$'),
  add constraint evento_con_sitio check (lugar_id is not null or ubicacion_nombre is not null),
  add constraint evento_otros_con_nombre check ((actividad_id = 'otros') = (actividad_otra is not null));

update public.eventos e
set region = l.region
from public.lugares l
where l.id = e.lugar_id;

create index eventos_actividad_idx on public.eventos (actividad_id);
create index eventos_region_fecha_idx on public.eventos (region, empieza);

-- El lugar manda: su zona y su actividad no se pueden contradecir desde la app.
create function private.completar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lugar public.lugares;
begin
  if new.lugar_id is null then
    return new;
  end if;

  select * into lugar from public.lugares where id = new.lugar_id;
  if lugar.actividad_id <> new.actividad_id then
    raise exception 'Ese lugar no es para esa actividad' using errcode = 'check_violation';
  end if;
  new.region := lugar.region;
  -- Con lugar de catálogo no hay ubicación a mano.
  new.ubicacion_nombre := null;
  new.ubicacion_direccion := null;
  return new;
end;
$$;

create trigger eventos_se_completan
  before insert or update of lugar_id, actividad_id on public.eventos
  for each row execute function private.completar_evento();

-- Permisos de columnas. La dirección exacta, como el enlace de WhatsApp, no se lee de
-- la tabla: la sirve detalle_evento() solo a quien organiza o se ha apuntado.
revoke select, insert, update on public.eventos from authenticated;
grant select (
  id, creador_id, lugar_id, actividad_id, actividad_otra, ubicacion_nombre, region, titulo,
  descripcion, empieza, plazas_maximas, visibilidad, grupo_id, creado, actualizado
) on public.eventos to authenticated;
grant insert (
  creador_id, lugar_id, actividad_id, actividad_otra, ubicacion_nombre, ubicacion_direccion,
  region, titulo, descripcion, empieza, plazas_maximas, visibilidad, grupo_id, enlace_whatsapp
) on public.eventos to authenticated;
grant update (
  lugar_id, ubicacion_nombre, ubicacion_direccion, titulo, descripcion, empieza,
  plazas_maximas, enlace_whatsapp
) on public.eventos to authenticated;

-- ---------------------------------------------------------------------------
-- Funciones para la app, adaptadas al modelo nuevo
-- ---------------------------------------------------------------------------

drop function public.eventos_visibles(text);

create function public.eventos_visibles(region text default null)
returns table (
  id uuid,
  titulo text,
  empieza timestamptz,
  actividad_id text,
  actividad_nombre text,
  lugar_id text,
  lugar_nombre text,
  visibilidad public.visibilidad_evento,
  grupo_nombre text,
  creador_id uuid,
  creador_nombre text,
  plazas_maximas integer,
  van bigint,
  mi_respuesta public.respuesta_evento,
  me_han_invitado boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.titulo,
    e.empieza,
    e.actividad_id,
    coalesce(e.actividad_otra, a.nombre),
    e.lugar_id,
    coalesce(l.nombre, e.ubicacion_nombre),
    e.visibilidad,
    g.nombre,
    e.creador_id,
    c.nombre_visible,
    e.plazas_maximas,
    (select count(*) from public.asistencias_evento x where x.evento_id = e.id and x.respuesta = 'voy'),
    (
      select x.respuesta from public.asistencias_evento x
      where x.evento_id = e.id and x.usuario_id = (select auth.uid())
    ),
    private.estoy_invitado_a_evento(e.id)
  from public.eventos e
  join public.actividades a on a.id = e.actividad_id
  join public.perfiles c on c.id = e.creador_id
  left join public.lugares l on l.id = e.lugar_id
  left join public.grupos g on g.id = e.grupo_id
  where (select auth.uid()) is not null
    -- Se siguen viendo unas horas después de empezar, mientras dura la quedada.
    and e.empieza > now() - interval '6 hours'
    and private.puedo_ver_evento(e.id)
    and (
      eventos_visibles.region is null
      or e.region = eventos_visibles.region
      -- Las mías salen siempre, sean de la zona que sean.
      or e.creador_id = (select auth.uid())
      or private.he_respondido_a_evento(e.id)
      or private.estoy_invitado_a_evento(e.id)
    )
  order by e.empieza;
$$;

drop function public.detalle_evento(uuid);

-- Ficha completa de una quedada. La dirección exacta, el enlace de WhatsApp y el chat
-- son solo para quien organiza o se ha apuntado.
create function public.detalle_evento(evento uuid)
returns table (
  id uuid,
  titulo text,
  descripcion text,
  empieza timestamptz,
  actividad_id text,
  actividad_nombre text,
  tipo_sitio public.tipo_sitio,
  lugar_id text,
  lugar_nombre text,
  ubicacion_direccion text,
  region text,
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
    e.actividad_id,
    coalesce(e.actividad_otra, a.nombre),
    a.tipo_sitio,
    e.lugar_id,
    coalesce(l.nombre, e.ubicacion_nombre),
    case when dentro.si then e.ubicacion_direccion end,
    e.region,
    e.visibilidad,
    e.grupo_id,
    g.nombre,
    e.creador_id,
    c.nombre_visible,
    c.nombre_usuario::text,
    c.ruta_foto,
    e.plazas_maximas,
    (select count(*) from public.asistencias_evento x where x.evento_id = e.id and x.respuesta = 'voy'),
    yo.respuesta,
    private.estoy_invitado_a_evento(e.id),
    case when dentro.si then e.enlace_whatsapp end,
    case when yo.respuesta in ('voy', 'quiza') then cv.id end
  from public.eventos e
  join public.actividades a on a.id = e.actividad_id
  join public.perfiles c on c.id = e.creador_id
  left join public.lugares l on l.id = e.lugar_id
  left join public.grupos g on g.id = e.grupo_id
  left join public.conversaciones cv on cv.evento_id = e.id
  left join public.asistencias_evento yo
    on yo.evento_id = e.id and yo.usuario_id = (select auth.uid())
  cross join lateral (
    select coalesce(yo.respuesta in ('voy', 'quiza'), false)
      or e.creador_id = (select auth.uid()) as si
  ) dentro
  where e.id = evento
    and (select auth.uid()) is not null
    and private.puedo_ver_evento(e.id);
$$;

revoke all on function public.eventos_visibles(text) from public, anon;
revoke all on function public.detalle_evento(uuid) from public, anon;
grant execute on function public.eventos_visibles(text) to authenticated;
grant execute on function public.detalle_evento(uuid) to authenticated;

-- Exportación de datos: las quedadas creadas llevan ahora actividad y sitio completos.
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
    'grupos', coalesce((select jsonb_agg(to_jsonb(g)) from public.mis_grupos() g), '[]'::jsonb),
    'mensajes_enviados', coalesce(
      (
        select jsonb_agg(to_jsonb(m) order by m.id)
        from public.mensajes m
        where m.autor_id = (select auth.uid())
      ),
      '[]'::jsonb
    ),
    'eventos_creados', coalesce(
      (
        select jsonb_agg(to_jsonb(d))
        from public.eventos e
        cross join lateral public.detalle_evento(e.id) d
        where e.creador_id = (select auth.uid())
      ),
      '[]'::jsonb
    ),
    'respuestas_a_eventos', coalesce(
      (
        select jsonb_agg(to_jsonb(a))
        from public.asistencias_evento a
        where a.usuario_id = (select auth.uid())
      ),
      '[]'::jsonb
    ),
    'notificaciones', coalesce((select jsonb_agg(to_jsonb(n)) from public.notificaciones n), '[]'::jsonb),
    'dispositivos', coalesce(
      (select jsonb_agg(jsonb_build_object('plataforma', t.plataforma, 'actualizado', t.actualizado))
       from public.tokens_push t),
      '[]'::jsonb
    )
  );
$$;
