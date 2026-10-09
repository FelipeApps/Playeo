-- Fase 6: notificaciones dentro de la app y preparación de las push.

create extension if not exists pg_net with schema extensions;

create type public.tipo_notificacion as enum (
  'solicitud_amistad',
  'amistad_aceptada',
  'invitacion_grupo',
  'invitacion_evento',
  'mensaje_nuevo'
);

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.notificaciones (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  tipo public.tipo_notificacion not null,
  -- Quién la provoca. Si borra su cuenta, sus avisos desaparecen con él.
  actor_id uuid references public.perfiles (id) on delete cascade,
  -- Adónde lleva al tocarla: grupo_id, evento_id o conversacion_id, y un título.
  datos jsonb not null default '{}'::jsonb,
  leida timestamptz,
  creada timestamptz not null default now()
);

-- El centro de notificaciones: las mías, de la más nueva a la más antigua.
create index notificaciones_usuario_idx on public.notificaciones (usuario_id, creada desc);
create index notificaciones_actor_idx on public.notificaciones (actor_id);
-- Mensajes nuevos: un solo aviso sin leer por conversación, no uno por mensaje.
create unique index notificaciones_mensaje_unico_idx
  on public.notificaciones (usuario_id, (datos ->> 'conversacion_id'))
  where tipo = 'mensaje_nuevo' and leida is null;

-- Un token identifica un dispositivo. Si otra persona inicia sesión en el mismo móvil,
-- el token pasa a ser suyo: por eso la clave es el token y no el usuario.
create table public.tokens_push (
  token text primary key constraint token_expo check (token ~ '^Expo(nent)?PushToken\[.+\]$'),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  plataforma text not null constraint plataforma_valida check (plataforma in ('ios', 'android')),
  actualizado timestamptz not null default now()
);

create index tokens_push_usuario_idx on public.tokens_push (usuario_id);

-- Ajustes internos (URL y secreto de la función de push). Vive en el esquema privado:
-- la API no lo expone y ningún rol de la app tiene permisos sobre él.
create table private.ajustes (
  clave text primary key,
  valor text not null
);
revoke all on private.ajustes from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Creación de notificaciones
-- ---------------------------------------------------------------------------

-- Punto único por el que se crean. No avisa a uno mismo ni cuando hay bloqueo.
-- Los parámetros llevan prefijo para no confundirse con las columnas de la tabla.
create function private.notificar(
  p_destinatario uuid,
  p_tipo public.tipo_notificacion,
  p_actor uuid,
  p_datos jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_destinatario is null or p_destinatario = p_actor then
    return;
  end if;
  if exists (
    select 1 from public.bloqueos
    where (bloqueador_id = p_destinatario and bloqueado_id = p_actor)
       or (bloqueador_id = p_actor and bloqueado_id = p_destinatario)
  ) then
    return;
  end if;

  if p_tipo = 'mensaje_nuevo' then
    -- Si ya hay un aviso sin leer de esa conversación, se actualiza en vez de apilar otro.
    insert into public.notificaciones (usuario_id, tipo, actor_id, datos)
    values (p_destinatario, p_tipo, p_actor, p_datos)
    on conflict (usuario_id, (datos ->> 'conversacion_id'))
      where tipo = 'mensaje_nuevo' and leida is null
    do update set actor_id = excluded.actor_id, datos = excluded.datos, creada = now();
  else
    insert into public.notificaciones (usuario_id, tipo, actor_id, datos)
    values (p_destinatario, p_tipo, p_actor, p_datos);
  end if;
end;
$$;

revoke all on function private.notificar(uuid, public.tipo_notificacion, uuid, jsonb)
  from public, anon, authenticated;

create function private.notificar_amistad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.estado = 'pendiente' then
    perform private.notificar(new.destinatario_id, 'solicitud_amistad', new.solicitante_id);
  elsif tg_op = 'UPDATE' and new.estado = 'aceptada' and old.estado = 'pendiente' then
    perform private.notificar(new.solicitante_id, 'amistad_aceptada', new.destinatario_id);
    -- La solicitud ya está respondida: su aviso sobra.
    delete from public.notificaciones
    where usuario_id = new.destinatario_id
      and actor_id = new.solicitante_id
      and tipo = 'solicitud_amistad';
  elsif tg_op = 'DELETE' then
    delete from public.notificaciones
    where usuario_id = old.destinatario_id
      and actor_id = old.solicitante_id
      and tipo = 'solicitud_amistad';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger amistades_notifican
  after insert or update of estado or delete on public.amistades
  for each row execute function private.notificar_amistad();

create function private.notificar_invitacion_grupo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.notificar(
      new.invitado_id,
      'invitacion_grupo',
      new.invitador_id,
      jsonb_build_object(
        'grupo_id', new.grupo_id,
        'titulo', (select nombre from public.grupos where id = new.grupo_id)
      )
    );
    return new;
  end if;
  -- Aceptada, rechazada o cancelada: el aviso deja de tener sentido.
  delete from public.notificaciones
  where usuario_id = old.invitado_id
    and tipo = 'invitacion_grupo'
    and datos ->> 'grupo_id' = old.grupo_id::text;
  return old;
end;
$$;

create trigger invitaciones_grupo_notifican
  after insert or delete on public.invitaciones_grupo
  for each row execute function private.notificar_invitacion_grupo();

create function private.notificar_invitacion_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.notificar(
      new.invitado_id,
      'invitacion_evento',
      new.invitador_id,
      jsonb_build_object(
        'evento_id', new.evento_id,
        'titulo', (select titulo from public.eventos where id = new.evento_id)
      )
    );
    return new;
  end if;
  delete from public.notificaciones
  where usuario_id = old.invitado_id
    and tipo = 'invitacion_evento'
    and datos ->> 'evento_id' = old.evento_id::text;
  return old;
end;
$$;

create trigger invitaciones_evento_notifican
  after insert or delete on public.invitaciones_evento
  for each row execute function private.notificar_invitacion_evento();

-- Un mensaje avisa al resto de miembros de la conversación.
create function private.notificar_mensaje()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversacion public.conversaciones;
  titulo text;
  miembro record;
begin
  select * into conversacion from public.conversaciones where id = new.conversacion_id;
  titulo := case conversacion.tipo
    when 'grupo' then (select nombre from public.grupos where id = conversacion.grupo_id)
    when 'evento' then (select e.titulo from public.eventos e where e.id = conversacion.evento_id)
    else null
  end;

  for miembro in
    select usuario_id from public.miembros_conversacion
    where conversacion_id = new.conversacion_id and usuario_id <> new.autor_id
  loop
    perform private.notificar(
      miembro.usuario_id,
      'mensaje_nuevo',
      new.autor_id,
      jsonb_build_object(
        'conversacion_id', new.conversacion_id,
        'titulo', titulo,
        -- Un extracto para la push; el mensaje completo se lee en el chat.
        'extracto', left(new.cuerpo, 120)
      )
    );
  end loop;
  return new;
end;
$$;

create trigger mensajes_notifican
  after insert on public.mensajes
  for each row execute function private.notificar_mensaje();

-- Leer una conversación deja leído también su aviso.
create or replace function public.marcar_conversacion_leida(conversacion uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.miembros_conversacion
  set leido_hasta = now()
  where conversacion_id = conversacion and usuario_id = (select auth.uid());

  update public.notificaciones
  set leida = now()
  where usuario_id = (select auth.uid())
    and tipo = 'mensaje_nuevo'
    and leida is null
    and datos ->> 'conversacion_id' = conversacion::text;
$$;

-- ---------------------------------------------------------------------------
-- Push
-- ---------------------------------------------------------------------------

-- Cada notificación nueva (o actualizada, en el caso de los mensajes) se envía a la
-- Edge Function enviar-push, que la reparte a los dispositivos del usuario con Expo Push.
-- Si la URL o el secreto no están configurados en private.ajustes, no se envía nada:
-- las notificaciones dentro de la app funcionan igual.
create function private.encolar_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text := (select valor from private.ajustes where clave = 'push_url');
  secreto text := (select valor from private.ajustes where clave = 'push_secreto');
begin
  if url is null or secreto is null or new.leida is not null then
    return new;
  end if;
  -- Sin dispositivos registrados no hay nada que enviar.
  if not exists (select 1 from public.tokens_push where usuario_id = new.usuario_id) then
    return new;
  end if;

  perform net.http_post(
    url := url,
    body := jsonb_build_object('notificacion_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-secreto-push', secreto)
  );
  return new;
exception when others then
  -- Un fallo al encolar la push nunca debe impedir que se guarde la notificación.
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.notificaciones enable row level security;
alter table public.tokens_push enable row level security;
alter table private.ajustes enable row level security;

revoke all on public.notificaciones, public.tokens_push from anon, authenticated;

-- Notificaciones: las crean los triggers. La app las lee, las marca y las borra.
grant select, delete on public.notificaciones to authenticated;
grant update (leida) on public.notificaciones to authenticated;

create policy "Ver solo mis notificaciones"
  on public.notificaciones for select
  to authenticated
  using (usuario_id = (select auth.uid()));

create policy "Marcar como leídas solo las mías"
  on public.notificaciones for update
  to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create policy "Borrar solo mis notificaciones"
  on public.notificaciones for delete
  to authenticated
  using (usuario_id = (select auth.uid()));

-- Tokens: se registran con registrar_token_push(). La app solo ve y borra los suyos.
grant select, delete on public.tokens_push to authenticated;

create policy "Ver solo mis dispositivos"
  on public.tokens_push for select
  to authenticated
  using (usuario_id = (select auth.uid()));

create policy "Dar de baja solo mis dispositivos"
  on public.tokens_push for delete
  to authenticated
  using (usuario_id = (select auth.uid()));

-- Ajustes: sin ninguna política a propósito. Con RLS activado y sin políticas, ningún
-- rol de la app puede leerlos ni escribirlos; solo los triggers definer y el administrador.
comment on table private.ajustes is
  'Ajustes internos. RLS activado sin políticas a propósito: nadie accede desde la API.';

-- ---------------------------------------------------------------------------
-- Funciones para la app
-- ---------------------------------------------------------------------------

-- Registra el dispositivo actual. Es definer porque, si el token era de otra cuenta
-- (misma persona con dos cuentas, o un móvil compartido), tiene que poder reasignarlo.
create function public.registrar_token_push(token text, plataforma text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Hay que iniciar sesión' using errcode = 'insufficient_privilege';
  end if;

  insert into public.tokens_push (token, usuario_id, plataforma)
  values (registrar_token_push.token, (select auth.uid()), registrar_token_push.plataforma)
  -- Por nombre de restricción: "token" a secas chocaría con el parámetro de la función.
  on conflict on constraint tokens_push_pkey do update
    set usuario_id = excluded.usuario_id, plataforma = excluded.plataforma, actualizado = now();
end;
$$;

-- Centro de notificaciones, con el nombre y la foto de quien provoca cada una.
create function public.mis_notificaciones()
returns table (
  id bigint,
  tipo public.tipo_notificacion,
  actor_id uuid,
  actor_nombre text,
  actor_foto text,
  datos jsonb,
  leida timestamptz,
  creada timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.tipo, n.actor_id, p.nombre_visible, p.ruta_foto, n.datos, n.leida, n.creada
  from public.notificaciones n
  left join public.perfiles p on p.id = n.actor_id
  where n.usuario_id = (select auth.uid())
  order by n.creada desc
  limit 100;
$$;

revoke all on function public.registrar_token_push(text, text) from public, anon;
revoke all on function public.mis_notificaciones() from public, anon;
grant execute on function public.registrar_token_push(text, text) to authenticated;
grant execute on function public.mis_notificaciones() to authenticated;

-- El trigger de push va al final: necesita que exista tokens_push.
create trigger notificaciones_encolan_push
  after insert or update of creada on public.notificaciones
  for each row execute function private.encolar_push();

-- Las notificaciones llegan en vivo a la app abierta.
alter publication supabase_realtime add table public.notificaciones;

-- Exportación de datos: se añaden las notificaciones y los dispositivos registrados.
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
    ),
    'notificaciones', coalesce((select jsonb_agg(to_jsonb(n)) from public.notificaciones n), '[]'::jsonb),
    'dispositivos', coalesce(
      (select jsonb_agg(jsonb_build_object('plataforma', t.plataforma, 'actualizado', t.actualizado))
       from public.tokens_push t),
      '[]'::jsonb
    )
  );
$$;
