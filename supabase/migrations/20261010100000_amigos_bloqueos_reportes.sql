-- Fase 2: amistades, bloqueos y reportes.

create type public.estado_amistad as enum ('pendiente', 'aceptada');
create type public.motivo_reporte as enum ('spam', 'acoso', 'contenido_inapropiado', 'suplantacion', 'otro');
create type public.estado_reporte as enum ('abierto', 'revisado', 'cerrado');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Una fila por pareja. Mientras está pendiente es una solicitud; al aceptarla, amistad.
-- Rechazar, cancelar o dejar de ser amigos es borrar la fila.
create table public.amistades (
  solicitante_id uuid not null references public.perfiles (id) on delete cascade,
  destinatario_id uuid not null references public.perfiles (id) on delete cascade,
  estado public.estado_amistad not null default 'pendiente',
  creada timestamptz not null default now(),
  respondida timestamptz,
  primary key (solicitante_id, destinatario_id),
  constraint amistad_con_otra_persona check (solicitante_id <> destinatario_id)
);

-- Una sola relación por pareja, la pida quien la pida.
create unique index amistades_pareja_unica_idx
  on public.amistades (least(solicitante_id, destinatario_id), greatest(solicitante_id, destinatario_id));
-- "Mis solicitudes recibidas" y "mis amigos" desde el lado del destinatario.
create index amistades_destinatario_estado_idx on public.amistades (destinatario_id, estado);

create table public.bloqueos (
  bloqueador_id uuid not null references public.perfiles (id) on delete cascade,
  bloqueado_id uuid not null references public.perfiles (id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (bloqueador_id, bloqueado_id),
  constraint bloqueo_a_otra_persona check (bloqueador_id <> bloqueado_id)
);

-- "¿Me ha bloqueado esta persona?" se consulta por el lado contrario de la clave primaria.
create index bloqueos_bloqueado_idx on public.bloqueos (bloqueado_id);

-- Cola de moderación. Los reportes sobreviven al borrado de las cuentas implicadas
-- (los identificadores pasan a null) para no perder el historial.
create table public.reportes (
  id bigint generated always as identity primary key,
  reportante_id uuid references public.perfiles (id) on delete set null,
  usuario_reportado_id uuid references public.perfiles (id) on delete set null,
  -- Identificador del mensaje reportado. La clave foránea se añade en la fase de chat.
  mensaje_id bigint,
  -- Copia del texto reportado, por si el mensaje se borra antes de revisarlo.
  contenido text constraint contenido_largo check (char_length(contenido) <= 2000),
  motivo public.motivo_reporte not null,
  detalles text constraint detalles_largo check (char_length(detalles) <= 500),
  estado public.estado_reporte not null default 'abierto',
  creado timestamptz not null default now()
);

create index reportes_reportante_idx on public.reportes (reportante_id);
create index reportes_usuario_reportado_idx on public.reportes (usuario_reportado_id);
-- La moderación trabaja sobre los abiertos, del más antiguo al más nuevo.
create index reportes_abiertos_idx on public.reportes (creado) where estado = 'abierto';

-- ---------------------------------------------------------------------------
-- Funciones auxiliares para las políticas
-- ---------------------------------------------------------------------------
-- Son security definer porque tienen que mirar filas que quien pregunta no puede ver
-- (por ejemplo, un bloqueo hecho por la otra persona). Siempre comparan contra
-- auth.uid(): nadie puede preguntar por la relación entre dos terceros.

create function private.es_mi_amigo(otro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.amistades
    where estado = 'aceptada'
      and (
        (solicitante_id = (select auth.uid()) and destinatario_id = otro)
        or (destinatario_id = (select auth.uid()) and solicitante_id = otro)
      )
  );
$$;

-- Verdadero si cualquiera de los dos ha bloqueado al otro.
create function private.hay_bloqueo_con(otro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bloqueos
    where (bloqueador_id = (select auth.uid()) and bloqueado_id = otro)
       or (bloqueador_id = otro and bloqueado_id = (select auth.uid()))
  );
$$;

revoke all on function private.es_mi_amigo(uuid) from public, anon;
revoke all on function private.hay_bloqueo_con(uuid) from public, anon;
grant execute on function private.es_mi_amigo(uuid) to authenticated;
grant execute on function private.hay_bloqueo_con(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function private.sellar_respuesta_amistad()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado = 'aceptada' and old.estado = 'pendiente' then
    new.respondida := now();
  end if;
  return new;
end;
$$;

create trigger amistades_respuesta
  before update on public.amistades
  for each row execute function private.sellar_respuesta_amistad();

-- Bloquear rompe la amistad y cancela las solicitudes entre ambos.
create function private.romper_amistad_al_bloquear()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.amistades
  where (solicitante_id = new.bloqueador_id and destinatario_id = new.bloqueado_id)
     or (solicitante_id = new.bloqueado_id and destinatario_id = new.bloqueador_id);
  return new;
end;
$$;

create trigger bloqueos_rompen_amistad
  after insert on public.bloqueos
  for each row execute function private.romper_amistad_al_bloquear();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.amistades enable row level security;
alter table public.bloqueos enable row level security;
alter table public.reportes enable row level security;

revoke all on public.amistades, public.bloqueos, public.reportes from anon, authenticated;

-- Amistades
grant select, insert, delete on public.amistades to authenticated;
grant update (estado) on public.amistades to authenticated;

create policy "Ver las solicitudes y amistades en las que participo"
  on public.amistades for select
  to authenticated
  using (
    solicitante_id = (select auth.uid()) or destinatario_id = (select auth.uid())
  );

create policy "Enviar solicitudes en mi nombre a quien no hay bloqueo"
  on public.amistades for insert
  to authenticated
  with check (
    solicitante_id = (select auth.uid())
    and estado = 'pendiente'
    and not (select private.hay_bloqueo_con(destinatario_id))
  );

create policy "Solo el destinatario acepta la solicitud"
  on public.amistades for update
  to authenticated
  using (destinatario_id = (select auth.uid()) and estado = 'pendiente')
  with check (destinatario_id = (select auth.uid()) and estado = 'aceptada');

create policy "Cualquiera de los dos puede rechazar, cancelar o eliminar"
  on public.amistades for delete
  to authenticated
  using (
    solicitante_id = (select auth.uid()) or destinatario_id = (select auth.uid())
  );

-- Bloqueos: solo existen para quien los hace. El bloqueado no puede saber que lo está.
grant select, insert, delete on public.bloqueos to authenticated;

create policy "Ver solo mis bloqueos"
  on public.bloqueos for select
  to authenticated
  using (bloqueador_id = (select auth.uid()));

create policy "Bloquear en mi nombre"
  on public.bloqueos for insert
  to authenticated
  with check (bloqueador_id = (select auth.uid()));

create policy "Desbloquear a quien yo bloqueé"
  on public.bloqueos for delete
  to authenticated
  using (bloqueador_id = (select auth.uid()));

-- Reportes: se envían y se consultan los propios. Revisarlos es cosa de moderación,
-- que usa la clave de servicio y no pasa por RLS.
grant select on public.reportes to authenticated;
grant insert (reportante_id, usuario_reportado_id, mensaje_id, contenido, motivo, detalles)
  on public.reportes to authenticated;

create policy "Ver solo los reportes que he enviado"
  on public.reportes for select
  to authenticated
  using (reportante_id = (select auth.uid()));

create policy "Reportar en mi nombre a otra persona"
  on public.reportes for insert
  to authenticated
  with check (
    reportante_id = (select auth.uid())
    and usuario_reportado_id is not null
    and usuario_reportado_id <> (select auth.uid())
  );

-- Perfiles: la política de la fase 1 se sustituye por la definitiva.
drop policy "Leer mi perfil y los públicos" on public.perfiles;

create policy "Leer mi perfil, los públicos y los de mis amigos, sin bloqueos"
  on public.perfiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or (
      not (select private.hay_bloqueo_con(id))
      and (privacidad = 'publico' or (select private.es_mi_amigo(id)))
    )
  );

-- ---------------------------------------------------------------------------
-- Funciones para la app
-- ---------------------------------------------------------------------------
-- Un perfil "solo amigos" tiene que poder encontrarse para enviarle una solicitud, y
-- quien recibe una solicitud tiene que ver de quién es. Estas funciones devuelven la
-- tarjeta mínima (usuario, nombre y foto) saltándose la política de perfiles, pero
-- nunca muestran a nadie con quien haya un bloqueo.

create type public.relacion_usuario as enum (
  'yo', 'ninguna', 'amigo', 'solicitud_enviada', 'solicitud_recibida', 'bloqueado'
);

create function private.relacion_con(otro uuid)
returns public.relacion_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when otro = (select auth.uid()) then 'yo'::public.relacion_usuario
    when exists (
      select 1 from public.bloqueos
      where bloqueador_id = (select auth.uid()) and bloqueado_id = otro
    ) then 'bloqueado'
    else coalesce(
      (
        select case
          when a.estado = 'aceptada' then 'amigo'
          when a.solicitante_id = (select auth.uid()) then 'solicitud_enviada'
          else 'solicitud_recibida'
        end::public.relacion_usuario
        from public.amistades a
        where (a.solicitante_id = (select auth.uid()) and a.destinatario_id = otro)
           or (a.destinatario_id = (select auth.uid()) and a.solicitante_id = otro)
      ),
      'ninguna'
    )
  end;
$$;

revoke all on function private.relacion_con(uuid) from public, anon, authenticated;

create function public.buscar_usuarios(texto text)
returns table (
  id uuid,
  nombre_usuario text,
  nombre_visible text,
  ruta_foto text,
  relacion public.relacion_usuario
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nombre_usuario::text, p.nombre_visible, p.ruta_foto, private.relacion_con(p.id)
  from public.perfiles p
  where (select auth.uid()) is not null
    and char_length(trim(texto)) >= 2
    -- Los comodines que escriba el usuario se buscan como texto literal.
    and p.nombre_usuario::text ilike
      '%' || replace(replace(replace(trim(texto), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    and p.id <> (select auth.uid())
    and not private.hay_bloqueo_con(p.id)
  order by (lower(p.nombre_usuario::text) = lower(trim(texto))) desc, p.nombre_usuario
  limit 20;
$$;

-- Amigos y solicitudes pendientes en ambos sentidos, con la tarjeta de cada persona.
create function public.mis_relaciones()
returns table (
  id uuid,
  nombre_usuario text,
  nombre_visible text,
  ruta_foto text,
  relacion public.relacion_usuario,
  desde timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.nombre_usuario::text,
    p.nombre_visible,
    p.ruta_foto,
    case
      when a.estado = 'aceptada' then 'amigo'
      when a.solicitante_id = (select auth.uid()) then 'solicitud_enviada'
      else 'solicitud_recibida'
    end::public.relacion_usuario,
    coalesce(a.respondida, a.creada)
  from public.amistades a
  join public.perfiles p
    on p.id = case
      when a.solicitante_id = (select auth.uid()) then a.destinatario_id
      else a.solicitante_id
    end
  where a.solicitante_id = (select auth.uid()) or a.destinatario_id = (select auth.uid())
  order by p.nombre_visible;
$$;

create function public.mis_bloqueados()
returns table (id uuid, nombre_usuario text, nombre_visible text, ruta_foto text, desde timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nombre_usuario::text, p.nombre_visible, p.ruta_foto, b.creado
  from public.bloqueos b
  join public.perfiles p on p.id = b.bloqueado_id
  where b.bloqueador_id = (select auth.uid())
  order by b.creado desc;
$$;

-- Ficha de otra persona. Sin fila si me ha bloqueado. La biografía y la zona solo se
-- incluyen si su perfil es público o somos amigos.
create function public.ver_usuario(usuario uuid)
returns table (
  id uuid,
  nombre_usuario text,
  nombre_visible text,
  ruta_foto text,
  relacion public.relacion_usuario,
  perfil_visible boolean,
  bio text,
  zona text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.nombre_usuario::text,
    p.nombre_visible,
    p.ruta_foto,
    private.relacion_con(p.id),
    v.visible,
    case when v.visible then p.bio end,
    case when v.visible then p.zona end
  from public.perfiles p
  cross join lateral (
    select
      p.id = (select auth.uid())
      or (
        not private.hay_bloqueo_con(p.id)
        and (p.privacidad = 'publico' or private.es_mi_amigo(p.id))
      ) as visible
  ) v
  where p.id = usuario
    and (select auth.uid()) is not null
    -- Si esa persona me ha bloqueado, para mí no existe.
    and not exists (
      select 1 from public.bloqueos b
      where b.bloqueador_id = p.id and b.bloqueado_id = (select auth.uid())
    );
$$;

revoke all on function public.buscar_usuarios(text) from public, anon;
revoke all on function public.mis_relaciones() from public, anon;
revoke all on function public.mis_bloqueados() from public, anon;
revoke all on function public.ver_usuario(uuid) from public, anon;
grant execute on function public.buscar_usuarios(text) to authenticated;
grant execute on function public.mis_relaciones() to authenticated;
grant execute on function public.mis_bloqueados() to authenticated;
grant execute on function public.ver_usuario(uuid) to authenticated;

-- Exportación de datos: se añaden amistades, bloqueos y reportes enviados.
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
    'reportes_enviados', coalesce((select jsonb_agg(to_jsonb(r)) from public.reportes r), '[]'::jsonb)
  );
$$;
