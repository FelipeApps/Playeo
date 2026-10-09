-- Fase 5: eventos de playa ("quedadas"), asistencia, invitaciones y chat del evento.
-- El catálogo de playas se carga en la migración siguiente (20261013100100_playas_catalogo).

create type public.visibilidad_evento as enum ('amigos', 'grupo', 'publico');
create type public.respuesta_evento as enum ('voy', 'quiza', 'no_voy');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Copia mínima del catálogo de la app, para tener clave foránea e índice por playa.
-- Las fotos, coordenadas y características siguen viviendo en la app.
create table public.playas (
  id text primary key,
  nombre text not null,
  region text not null
);

create index playas_region_idx on public.playas (region);

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  creador_id uuid not null references public.perfiles (id) on delete cascade,
  -- El punto de encuentro es siempre una playa del catálogo. No se guarda ninguna
  -- ubicación de los usuarios.
  playa_id text not null references public.playas (id),
  titulo text not null constraint titulo_evento_largo check (char_length(titulo) between 3 and 80),
  descripcion text constraint descripcion_evento_larga check (char_length(descripcion) <= 500),
  empieza timestamptz not null,
  -- Nulo = sin límite. Cuenta a quien crea el evento.
  plazas_maximas integer constraint plazas_razonables check (plazas_maximas between 2 and 500),
  visibilidad public.visibilidad_evento not null default 'amigos',
  grupo_id uuid references public.grupos (id) on delete cascade,
  enlace_whatsapp text constraint enlace_whatsapp_evento_valido check (
    enlace_whatsapp ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{10,64}(\?[A-Za-z0-9_=&%-]*)?$'
  ),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  constraint evento_de_grupo_con_grupo check ((visibilidad = 'grupo') = (grupo_id is not null))
);

-- "Qué hay en esta playa estos días" y "próximas quedadas", las dos consultas habituales.
create index eventos_playa_fecha_idx on public.eventos (playa_id, empieza);
create index eventos_fecha_idx on public.eventos (empieza);
create index eventos_creador_idx on public.eventos (creador_id);
create index eventos_grupo_idx on public.eventos (grupo_id) where grupo_id is not null;

create trigger eventos_actualizado
  before update on public.eventos
  for each row execute function private.marcar_actualizado();

create table public.asistencias_evento (
  evento_id uuid not null references public.eventos (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  respuesta public.respuesta_evento not null,
  actualizada timestamptz not null default now(),
  primary key (evento_id, usuario_id)
);

create index asistencias_evento_usuario_idx on public.asistencias_evento (usuario_id);

-- Una fila es una invitación pendiente; al responder al evento, desaparece.
create table public.invitaciones_evento (
  evento_id uuid not null references public.eventos (id) on delete cascade,
  invitado_id uuid not null references public.perfiles (id) on delete cascade,
  invitador_id uuid not null references public.perfiles (id) on delete cascade,
  creada timestamptz not null default now(),
  primary key (evento_id, invitado_id),
  constraint invitacion_evento_a_otra_persona check (invitado_id <> invitador_id)
);

create index invitaciones_evento_invitado_idx on public.invitaciones_evento (invitado_id);
create index invitaciones_evento_invitador_idx on public.invitaciones_evento (invitador_id);

-- El chat del evento, anunciado en la fase 4.
alter table public.conversaciones
  add constraint conversaciones_evento_fk foreign key (evento_id)
  references public.eventos (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Funciones auxiliares para las políticas
-- ---------------------------------------------------------------------------

create function private.estoy_invitado_a_evento(evento uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invitaciones_evento
    where evento_id = evento and invitado_id = (select auth.uid())
  );
$$;

create function private.he_respondido_a_evento(evento uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.asistencias_evento
    where evento_id = evento and usuario_id = (select auth.uid())
  );
$$;

-- La regla de visibilidad de un evento, en un solo sitio. La usan la política de
-- eventos y todo lo que cuelga de ellos (asistencias, invitaciones, funciones).
-- Un bloqueo con quien lo creó lo oculta siempre, sea cual sea la visibilidad.
create function private.puedo_ver_evento(evento uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.eventos e
    where e.id = evento
      and (
        e.creador_id = (select auth.uid())
        or (
          not private.hay_bloqueo_con(e.creador_id)
          and (
            e.visibilidad = 'publico'
            or (e.visibilidad = 'amigos' and private.es_mi_amigo(e.creador_id))
            or (e.visibilidad = 'grupo' and private.soy_miembro_de(e.grupo_id))
            or private.estoy_invitado_a_evento(e.id)
            or private.he_respondido_a_evento(e.id)
          )
        )
      )
  );
$$;

-- Puede invitar quien creó el evento o quien va (o quizá va).
create function private.puedo_invitar_a_evento(evento uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.eventos where id = evento and creador_id = (select auth.uid())
  ) or exists (
    select 1 from public.asistencias_evento
    where evento_id = evento
      and usuario_id = (select auth.uid())
      and respuesta in ('voy', 'quiza')
  );
$$;

-- Nadie puede colar en un evento a alguien que tiene un bloqueo con quien lo creó.
create function private.bloqueo_entre_invitado_y_creador(evento uuid, invitado uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.eventos e
    join public.bloqueos b
      on (b.bloqueador_id = e.creador_id and b.bloqueado_id = invitado)
      or (b.bloqueador_id = invitado and b.bloqueado_id = e.creador_id)
    where e.id = evento
  );
$$;

revoke all on function private.estoy_invitado_a_evento(uuid) from public, anon;
revoke all on function private.he_respondido_a_evento(uuid) from public, anon;
revoke all on function private.puedo_ver_evento(uuid) from public, anon;
revoke all on function private.puedo_invitar_a_evento(uuid) from public, anon;
revoke all on function private.bloqueo_entre_invitado_y_creador(uuid, uuid) from public, anon;
grant execute on function private.estoy_invitado_a_evento(uuid) to authenticated;
grant execute on function private.he_respondido_a_evento(uuid) to authenticated;
grant execute on function private.puedo_ver_evento(uuid) to authenticated;
grant execute on function private.puedo_invitar_a_evento(uuid) to authenticated;
grant execute on function private.bloqueo_entre_invitado_y_creador(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Al crear un evento: su chat, y quien lo crea queda apuntado.
create function private.preparar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversaciones (tipo, evento_id) values ('evento', new.id);
  insert into public.asistencias_evento (evento_id, usuario_id, respuesta)
  values (new.id, new.creador_id, 'voy');
  return new;
end;
$$;

create trigger eventos_se_preparan
  after insert on public.eventos
  for each row execute function private.preparar_evento();

-- Plazas: se bloquea la fila del evento antes de contar, para que dos personas no
-- ocupen a la vez la última plaza.
create function private.comprobar_plazas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plazas integer;
  ocupadas integer;
begin
  new.actualizada := now();
  if new.respuesta <> 'voy' then
    return new;
  end if;

  select plazas_maximas into plazas from public.eventos where id = new.evento_id for update;
  if plazas is null then
    return new;
  end if;

  select count(*) into ocupadas
  from public.asistencias_evento
  where evento_id = new.evento_id and respuesta = 'voy' and usuario_id <> new.usuario_id;

  if ocupadas >= plazas then
    raise exception 'El evento está completo' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger asistencias_con_plazas
  before insert or update of respuesta on public.asistencias_evento
  for each row execute function private.comprobar_plazas();

-- Quien va o quizá va está en el chat del evento; quien dice que no, sale.
-- Responder a un evento consume la invitación que se tuviera.
create function private.sincronizar_chat_de_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fila public.asistencias_evento := coalesce(new, old);
  conversacion uuid;
begin
  select id into conversacion from public.conversaciones where evento_id = fila.evento_id;

  if tg_op <> 'DELETE' and new.respuesta in ('voy', 'quiza') then
    insert into public.miembros_conversacion (conversacion_id, usuario_id)
    values (conversacion, new.usuario_id)
    on conflict do nothing;
  else
    delete from public.miembros_conversacion
    where conversacion_id = conversacion and usuario_id = fila.usuario_id;
  end if;

  if tg_op <> 'DELETE' then
    delete from public.invitaciones_evento
    where evento_id = new.evento_id and invitado_id = new.usuario_id;
  end if;
  return fila;
end;
$$;

create trigger asistencias_sincronizan_chat
  after insert or update of respuesta or delete on public.asistencias_evento
  for each row execute function private.sincronizar_chat_de_evento();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.playas enable row level security;
alter table public.eventos enable row level security;
alter table public.asistencias_evento enable row level security;
alter table public.invitaciones_evento enable row level security;

revoke all on public.playas, public.eventos, public.asistencias_evento, public.invitaciones_evento
  from anon, authenticated;

-- Playas: catálogo de solo lectura.
grant select on public.playas to authenticated;

create policy "El catálogo de playas lo lee cualquier usuario registrado"
  on public.playas for select
  to authenticated
  using (true);

-- Eventos. El enlace de WhatsApp no se puede leer de la tabla: un evento público lo ve
-- cualquiera, y el enlace es solo para quien va. Lo sirve detalle_evento().
grant select (
  id, creador_id, playa_id, titulo, descripcion, empieza, plazas_maximas, visibilidad,
  grupo_id, creado, actualizado
) on public.eventos to authenticated;
grant insert (
  creador_id, playa_id, titulo, descripcion, empieza, plazas_maximas, visibilidad,
  grupo_id, enlace_whatsapp
) on public.eventos to authenticated;
grant update (playa_id, titulo, descripcion, empieza, plazas_maximas, enlace_whatsapp)
  on public.eventos to authenticated;
grant delete on public.eventos to authenticated;

create policy "Ver los eventos que me corresponden, nunca con bloqueo"
  on public.eventos for select
  to authenticated
  using (
    creador_id = (select auth.uid())
    or (
      not private.hay_bloqueo_con(creador_id)
      and (
        visibilidad = 'publico'
        or (visibilidad = 'amigos' and private.es_mi_amigo(creador_id))
        or (visibilidad = 'grupo' and private.soy_miembro_de(grupo_id))
        or private.estoy_invitado_a_evento(id)
        or private.he_respondido_a_evento(id)
      )
    )
  );

create policy "Crear eventos futuros en mi nombre; de grupo, solo en los míos"
  on public.eventos for insert
  to authenticated
  with check (
    creador_id = (select auth.uid())
    and empieza > now()
    and (grupo_id is null or (select private.soy_miembro_de(grupo_id)))
  );

create policy "Solo quien lo creó edita el evento"
  on public.eventos for update
  to authenticated
  using (creador_id = (select auth.uid()))
  with check (creador_id = (select auth.uid()));

create policy "Solo quien lo creó elimina el evento"
  on public.eventos for delete
  to authenticated
  using (creador_id = (select auth.uid()));

-- Asistencias
grant select, insert, delete on public.asistencias_evento to authenticated;
grant update (respuesta) on public.asistencias_evento to authenticated;

create policy "Ver quién va a los eventos que puedo ver"
  on public.asistencias_evento for select
  to authenticated
  using ((select private.puedo_ver_evento(evento_id)));

create policy "Responder en mi nombre a un evento que puedo ver"
  on public.asistencias_evento for insert
  to authenticated
  with check (
    usuario_id = (select auth.uid()) and (select private.puedo_ver_evento(evento_id))
  );

create policy "Cambiar solo mi respuesta"
  on public.asistencias_evento for update
  to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create policy "Retirar solo mi respuesta"
  on public.asistencias_evento for delete
  to authenticated
  using (usuario_id = (select auth.uid()));

-- Invitaciones
grant select, insert, delete on public.invitaciones_evento to authenticated;

create policy "Ver las invitaciones a eventos que envío o recibo"
  on public.invitaciones_evento for select
  to authenticated
  using (
    invitado_id = (select auth.uid()) or invitador_id = (select auth.uid())
  );

create policy "Invitar a un amigo a un evento al que voy, sin bloqueos"
  on public.invitaciones_evento for insert
  to authenticated
  with check (
    invitador_id = (select auth.uid())
    and (select private.puedo_invitar_a_evento(evento_id))
    and (select private.es_mi_amigo(invitado_id))
    and not (select private.hay_bloqueo_con(invitado_id))
    and not (select private.bloqueo_entre_invitado_y_creador(evento_id, invitado_id))
  );

create policy "Rechazar o cancelar una invitación a un evento"
  on public.invitaciones_evento for delete
  to authenticated
  using (
    invitado_id = (select auth.uid()) or invitador_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Funciones para la app
-- ---------------------------------------------------------------------------

-- Próximas quedadas que puedo ver, con lo necesario para pintar la lista.
-- `region` limita a una zona de costa; nulo = todas.
create function public.eventos_visibles(region text default null)
returns table (
  id uuid,
  titulo text,
  empieza timestamptz,
  playa_id text,
  playa_nombre text,
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
    e.playa_id,
    p.nombre,
    e.visibilidad,
    g.nombre,
    e.creador_id,
    c.nombre_visible,
    e.plazas_maximas,
    (select count(*) from public.asistencias_evento a where a.evento_id = e.id and a.respuesta = 'voy'),
    (
      select a.respuesta from public.asistencias_evento a
      where a.evento_id = e.id and a.usuario_id = (select auth.uid())
    ),
    private.estoy_invitado_a_evento(e.id)
  from public.eventos e
  join public.playas p on p.id = e.playa_id
  join public.perfiles c on c.id = e.creador_id
  left join public.grupos g on g.id = e.grupo_id
  where (select auth.uid()) is not null
    -- Se siguen viendo unas horas después de empezar, mientras dura la quedada.
    and e.empieza > now() - interval '6 hours'
    and private.puedo_ver_evento(e.id)
    and (
      eventos_visibles.region is null
      or p.region = eventos_visibles.region
      -- Las mías salen siempre, sean de la zona que sean.
      or e.creador_id = (select auth.uid())
      or private.he_respondido_a_evento(e.id)
      or private.estoy_invitado_a_evento(e.id)
    )
  order by e.empieza;
$$;

-- Ficha completa de un evento. El enlace de WhatsApp y el chat solo para quien va.
create function public.detalle_evento(evento uuid)
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
    case when yo.respuesta in ('voy', 'quiza') then e.enlace_whatsapp end,
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

create function public.asistentes_evento(evento uuid)
returns table (
  id uuid,
  nombre_usuario text,
  nombre_visible text,
  ruta_foto text,
  respuesta public.respuesta_evento
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nombre_usuario::text, p.nombre_visible, p.ruta_foto, a.respuesta
  from public.asistencias_evento a
  join public.perfiles p on p.id = a.usuario_id
  where a.evento_id = evento
    and private.puedo_ver_evento(evento)
    -- No se enseña a nadie con quien yo tenga un bloqueo.
    and (p.id = (select auth.uid()) or not private.hay_bloqueo_con(p.id))
  order by a.respuesta, p.nombre_visible;
$$;

-- Amigos a los que puedo invitar: sin respuesta, sin invitación y sin bloqueo con quien
-- creó el evento.
create function public.amigos_invitables_evento(evento uuid)
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
    and private.puedo_invitar_a_evento(evento)
    and not private.bloqueo_entre_invitado_y_creador(evento, p.id)
    and not exists (
      select 1 from public.asistencias_evento x where x.evento_id = evento and x.usuario_id = p.id
    )
    and not exists (
      select 1 from public.invitaciones_evento i where i.evento_id = evento and i.invitado_id = p.id
    )
  order by p.nombre_visible;
$$;

revoke all on function public.eventos_visibles(text) from public, anon;
revoke all on function public.detalle_evento(uuid) from public, anon;
revoke all on function public.asistentes_evento(uuid) from public, anon;
revoke all on function public.amigos_invitables_evento(uuid) from public, anon;
grant execute on function public.eventos_visibles(text) to authenticated;
grant execute on function public.detalle_evento(uuid) to authenticated;
grant execute on function public.asistentes_evento(uuid) to authenticated;
grant execute on function public.amigos_invitables_evento(uuid) to authenticated;

-- La lista de chats ya puede titular las conversaciones de evento con su nombre.
create or replace function public.mis_conversaciones()
returns table (
  id uuid,
  tipo public.tipo_conversacion,
  titulo text,
  otro_id uuid,
  ruta_foto text,
  grupo_id uuid,
  evento_id uuid,
  ultimo_cuerpo text,
  ultimo_mio boolean,
  ultimo_mensaje timestamptz,
  no_leidos bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.tipo,
    case c.tipo
      when 'directa' then otro.nombre_visible
      when 'grupo' then g.nombre
      else ev.titulo
    end,
    otro.id,
    otro.ruta_foto,
    c.grupo_id,
    c.evento_id,
    ultimo.cuerpo,
    ultimo.autor_id = (select auth.uid()),
    c.ultimo_mensaje,
    (
      select count(*)
      from public.mensajes m
      where m.conversacion_id = c.id
        and m.creado > yo.leido_hasta
        and m.autor_id <> (select auth.uid())
        and not private.hay_bloqueo_con(m.autor_id)
    )
  from public.miembros_conversacion yo
  join public.conversaciones c on c.id = yo.conversacion_id
  left join public.grupos g on g.id = c.grupo_id
  left join public.eventos ev on ev.id = c.evento_id
  left join lateral (
    select p.id, p.nombre_visible, p.ruta_foto
    from public.miembros_conversacion mc
    join public.perfiles p on p.id = mc.usuario_id
    where c.tipo = 'directa'
      and mc.conversacion_id = c.id
      and mc.usuario_id <> (select auth.uid())
    limit 1
  ) otro on true
  left join lateral (
    select m.cuerpo, m.autor_id
    from public.mensajes m
    where m.conversacion_id = c.id
      and (m.autor_id = (select auth.uid()) or not private.hay_bloqueo_con(m.autor_id))
    order by m.id desc
    limit 1
  ) ultimo on true
  where yo.usuario_id = (select auth.uid())
    and (
      c.tipo <> 'directa'
      or (
        c.ultimo_mensaje is not null
        and otro.id is not null
        and not private.hay_bloqueo_con(otro.id)
      )
    )
    -- Los chats de quedadas pasadas dejan de ocupar sitio a la semana.
    and (c.tipo <> 'evento' or ev.empieza > now() - interval '7 days')
  order by coalesce(c.ultimo_mensaje, c.creada) desc;
$$;

-- Exportación de datos: se añaden los eventos creados y las respuestas dadas.
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
        select jsonb_agg(
          jsonb_build_object(
            'id', e.id, 'titulo', e.titulo, 'descripcion', e.descripcion, 'empieza', e.empieza,
            'playa_id', e.playa_id, 'visibilidad', e.visibilidad, 'creado', e.creado
          )
        )
        from public.eventos e
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
    )
  );
$$;
