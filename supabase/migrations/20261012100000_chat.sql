-- Fase 4: chat. Conversaciones directas, de grupo y (en la fase 5) de evento.

create type public.tipo_conversacion as enum ('directa', 'grupo', 'evento');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.conversaciones (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_conversacion not null,
  -- Solo en las de grupo. Al eliminar el grupo se va su chat.
  grupo_id uuid unique references public.grupos (id) on delete cascade,
  -- Solo en las de evento. La clave foránea se añade en la fase de eventos.
  evento_id uuid unique,
  -- Solo en las directas: los dos identificadores ordenados y unidos por ':'.
  -- Garantiza que entre dos personas hay una única conversación.
  clave_directa text unique,
  creada timestamptz not null default now(),
  -- Momento del último mensaje, para ordenar la lista de chats sin mirar mensajes.
  ultimo_mensaje timestamptz,
  constraint conversacion_coherente check (
    (tipo = 'directa' and clave_directa is not null and grupo_id is null and evento_id is null)
    or (tipo = 'grupo' and grupo_id is not null and clave_directa is null and evento_id is null)
    or (tipo = 'evento' and evento_id is not null and clave_directa is null and grupo_id is null)
  )
);

-- Quién está en cada conversación. Es la única fuente de verdad para el acceso al chat:
-- los triggers la mantienen al día con los miembros del grupo (y, luego, del evento).
create table public.miembros_conversacion (
  conversacion_id uuid not null references public.conversaciones (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  -- Todo mensaje anterior a este instante está leído. Una marca por persona y
  -- conversación en vez de una fila por mensaje.
  leido_hasta timestamptz not null default now(),
  unido timestamptz not null default now(),
  primary key (conversacion_id, usuario_id)
);

-- "Mis conversaciones".
create index miembros_conversacion_usuario_idx on public.miembros_conversacion (usuario_id);

create table public.mensajes (
  id bigint generated always as identity primary key,
  conversacion_id uuid not null references public.conversaciones (id) on delete cascade,
  -- Al borrar la cuenta se borran sus mensajes (derecho de supresión).
  autor_id uuid not null references public.perfiles (id) on delete cascade,
  cuerpo text not null constraint mensaje_largo check (char_length(cuerpo) between 1 and 2000),
  creado timestamptz not null default now()
);

-- La consulta más frecuente: los últimos mensajes de una conversación, paginando
-- hacia atrás por id (cursor), sin OFFSET.
create index mensajes_conversacion_idx on public.mensajes (conversacion_id, id desc);
create index mensajes_autor_idx on public.mensajes (autor_id);

-- Los reportes de la fase 2 ya guardaban el identificador del mensaje.
alter table public.reportes
  add constraint reportes_mensaje_fk foreign key (mensaje_id)
  references public.mensajes (id) on delete set null;
create index reportes_mensaje_idx on public.reportes (mensaje_id);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares para las políticas
-- ---------------------------------------------------------------------------

create function private.soy_miembro_de_conversacion(conversacion uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros_conversacion
    where conversacion_id = conversacion and usuario_id = (select auth.uid())
  );
$$;

-- Escribir exige ser miembro y, en una conversación directa, que no haya bloqueo con
-- la otra persona. En grupos el bloqueo no impide escribir: oculta los mensajes.
create function private.puedo_escribir_en(conversacion uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.soy_miembro_de_conversacion(conversacion)
    and not exists (
      select 1
      from public.conversaciones c
      join public.miembros_conversacion otro
        on otro.conversacion_id = c.id and otro.usuario_id <> (select auth.uid())
      where c.id = conversacion
        and c.tipo = 'directa'
        and private.hay_bloqueo_con(otro.usuario_id)
    );
$$;

-- Autoriza los canales privados de Realtime ("conversacion:<id>") que llevan el
-- indicador de "escribiendo". Cualquier otro tema, o un id mal formado, se rechaza.
create function private.puedo_usar_canal(tema text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  conversacion uuid;
begin
  if tema is null or tema not like 'conversacion:%' then
    return false;
  end if;
  begin
    conversacion := split_part(tema, ':', 2)::uuid;
  exception when others then
    return false;
  end;
  return private.soy_miembro_de_conversacion(conversacion);
end;
$$;

revoke all on function private.soy_miembro_de_conversacion(uuid) from public, anon;
revoke all on function private.puedo_escribir_en(uuid) from public, anon;
revoke all on function private.puedo_usar_canal(text) from public, anon;
grant execute on function private.soy_miembro_de_conversacion(uuid) to authenticated;
grant execute on function private.puedo_escribir_en(uuid) to authenticated;
grant execute on function private.puedo_usar_canal(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Cada grupo tiene su chat desde que nace.
create function private.crear_chat_de_grupo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversaciones (tipo, grupo_id) values ('grupo', new.id);
  return new;
end;
$$;

create trigger grupos_crean_chat
  after insert on public.grupos
  for each row execute function private.crear_chat_de_grupo();

-- Entrar o salir de un grupo es entrar o salir de su chat.
create function private.sincronizar_chat_de_grupo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.miembros_conversacion (conversacion_id, usuario_id)
    select c.id, new.usuario_id from public.conversaciones c where c.grupo_id = new.grupo_id
    on conflict do nothing;
    return new;
  end if;

  delete from public.miembros_conversacion mc
  using public.conversaciones c
  where c.id = mc.conversacion_id
    and c.grupo_id = old.grupo_id
    and mc.usuario_id = old.usuario_id;
  return old;
end;
$$;

create trigger miembros_grupo_sincronizan_chat
  after insert or delete on public.miembros_grupo
  for each row execute function private.sincronizar_chat_de_grupo();

-- Una conversación directa sin sus dos personas (alguien borró su cuenta) ya no sirve.
create function private.limpiar_directa_huerfana()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.conversaciones where id = old.conversacion_id and tipo = 'directa';
  return old;
end;
$$;

create trigger miembros_conversacion_limpian_directa
  after delete on public.miembros_conversacion
  for each row execute function private.limpiar_directa_huerfana();

-- Cada mensaje actualiza la fecha de su conversación y deja leída la del autor.
create function private.registrar_mensaje()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversaciones set ultimo_mensaje = new.creado where id = new.conversacion_id;
  update public.miembros_conversacion
  set leido_hasta = new.creado
  where conversacion_id = new.conversacion_id and usuario_id = new.autor_id;
  return new;
end;
$$;

create trigger mensajes_registran
  after insert on public.mensajes
  for each row execute function private.registrar_mensaje();

-- Chats de los grupos que ya existían antes de esta migración.
insert into public.conversaciones (tipo, grupo_id)
select 'grupo', g.id from public.grupos g;

insert into public.miembros_conversacion (conversacion_id, usuario_id)
select c.id, m.usuario_id
from public.miembros_grupo m
join public.conversaciones c on c.grupo_id = m.grupo_id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.conversaciones enable row level security;
alter table public.miembros_conversacion enable row level security;
alter table public.mensajes enable row level security;

revoke all on public.conversaciones, public.miembros_conversacion, public.mensajes
  from anon, authenticated;

-- Conversaciones: solo lectura. Las crean abrir_conversacion_directa() y los triggers.
grant select on public.conversaciones to authenticated;

create policy "Ver solo las conversaciones en las que estoy"
  on public.conversaciones for select
  to authenticated
  using ((select private.soy_miembro_de_conversacion(id)));

-- Miembros: se ve quién está y hasta dónde ha leído. Solo se toca la marca propia.
grant select on public.miembros_conversacion to authenticated;
grant update (leido_hasta) on public.miembros_conversacion to authenticated;

create policy "Ver a los miembros de mis conversaciones"
  on public.miembros_conversacion for select
  to authenticated
  using ((select private.soy_miembro_de_conversacion(conversacion_id)));

create policy "Marcar como leída solo mi parte"
  on public.miembros_conversacion for update
  to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- Mensajes
grant select, delete on public.mensajes to authenticated;
grant insert (conversacion_id, autor_id, cuerpo) on public.mensajes to authenticated;

create policy "Leer los mensajes de mis conversaciones, sin los de bloqueados"
  on public.mensajes for select
  to authenticated
  using (
    (select private.soy_miembro_de_conversacion(conversacion_id))
    and (autor_id = (select auth.uid()) or not private.hay_bloqueo_con(autor_id))
  );

create policy "Escribir en mi nombre donde soy miembro y no hay bloqueo"
  on public.mensajes for insert
  to authenticated
  with check (
    autor_id = (select auth.uid())
    and (select private.puedo_escribir_en(conversacion_id))
  );

create policy "Borrar solo mis mensajes"
  on public.mensajes for delete
  to authenticated
  using (autor_id = (select auth.uid()));

-- Reportes: si se reporta un mensaje, tiene que ser uno que yo pueda leer y ser de la
-- persona reportada. La subconsulta pasa por la política de mensajes.
drop policy "Reportar en mi nombre a otra persona" on public.reportes;

create policy "Reportar en mi nombre a otra persona o un mensaje suyo que veo"
  on public.reportes for insert
  to authenticated
  with check (
    reportante_id = (select auth.uid())
    and usuario_reportado_id is not null
    and usuario_reportado_id <> (select auth.uid())
    and (
      mensaje_id is null
      or exists (
        select 1 from public.mensajes m
        where m.id = mensaje_id and m.autor_id = usuario_reportado_id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Los mensajes nuevos y las marcas de lectura llegan por Realtime. Realtime aplica las
-- políticas de lectura de cada tabla: nadie recibe filas que no podría consultar.
alter publication supabase_realtime add table public.mensajes;
alter publication supabase_realtime add table public.miembros_conversacion;

-- El indicador de "escribiendo" viaja por un canal privado por conversación.
create policy "Escuchar el canal de mis conversaciones"
  on realtime.messages for select
  to authenticated
  using ((select private.puedo_usar_canal((select realtime.topic()))));

create policy "Emitir en el canal de mis conversaciones"
  on realtime.messages for insert
  to authenticated
  with check ((select private.puedo_usar_canal((select realtime.topic()))));

-- ---------------------------------------------------------------------------
-- Funciones para la app
-- ---------------------------------------------------------------------------

-- Devuelve la conversación directa con un amigo, creándola si aún no existe.
create function public.abrir_conversacion_directa(otro uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  clave text;
  conversacion uuid;
begin
  if yo is null or otro is null or otro = yo then
    raise exception 'Conversación no válida' using errcode = 'insufficient_privilege';
  end if;

  clave := least(yo, otro)::text || ':' || greatest(yo, otro)::text;
  select id into conversacion from public.conversaciones where clave_directa = clave;

  -- Una conversación ya abierta se puede retomar; para abrir una nueva hay que ser
  -- amigos, así nadie recibe mensajes de desconocidos.
  if conversacion is null then
    if private.hay_bloqueo_con(otro) or not private.es_mi_amigo(otro) then
      raise exception 'Solo puedes escribir a tus amigos' using errcode = 'insufficient_privilege';
    end if;

    insert into public.conversaciones (tipo, clave_directa)
    values ('directa', clave)
    on conflict (clave_directa) do nothing
    returning id into conversacion;

    if conversacion is null then
      select id into conversacion from public.conversaciones where clave_directa = clave;
    end if;

    insert into public.miembros_conversacion (conversacion_id, usuario_id)
    values (conversacion, yo), (conversacion, otro)
    on conflict do nothing;
  end if;

  return conversacion;
end;
$$;

-- Lista de chats: título, último mensaje y cuántos tengo sin leer.
create function public.mis_conversaciones()
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
      else 'Quedada'
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
    -- Las directas solo aparecen si ya tienen mensajes y no hay bloqueo con la otra persona.
    and (
      c.tipo <> 'directa'
      or (
        c.ultimo_mensaje is not null
        and otro.id is not null
        and not private.hay_bloqueo_con(otro.id)
      )
    )
  order by coalesce(c.ultimo_mensaje, c.creada) desc;
$$;

-- Quién está en una conversación y hasta dónde ha leído: nombres de los autores en los
-- chats de grupo y el "leído" de las directas.
create function public.participantes_conversacion(conversacion uuid)
returns table (
  id uuid,
  nombre_usuario text,
  nombre_visible text,
  ruta_foto text,
  leido_hasta timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nombre_usuario::text, p.nombre_visible, p.ruta_foto, mc.leido_hasta
  from public.miembros_conversacion mc
  join public.perfiles p on p.id = mc.usuario_id
  where mc.conversacion_id = conversacion
    and private.soy_miembro_de_conversacion(conversacion);
$$;

revoke all on function public.abrir_conversacion_directa(uuid) from public, anon;
revoke all on function public.mis_conversaciones() from public, anon;
revoke all on function public.participantes_conversacion(uuid) from public, anon;
grant execute on function public.abrir_conversacion_directa(uuid) to authenticated;
grant execute on function public.mis_conversaciones() to authenticated;
grant execute on function public.participantes_conversacion(uuid) to authenticated;

-- Exportación de datos: se añaden los mensajes enviados.
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
    )
  );
$$;
