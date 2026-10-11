-- Límites de frecuencia contra el abuso: una cuenta no puede inundar a otras con mensajes,
-- solicitudes, invitaciones, quedadas o reportes. Los topes están muy por encima del uso
-- normal; solo los nota quien automatiza o hace spam.
--
-- Se aplican en la base de datos, así que valen aunque alguien no use la app oficial.
-- Las tareas internas (migraciones, triggers sin sesión, moderación desde el panel) no
-- tienen usuario y no cuentan.

-- Argumentos del trigger: columna del autor, columna de la fecha, máximo y ventana en segundos.
create function private.limitar_frecuencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  recientes integer;
begin
  if yo is null then
    return new;
  end if;

  execute format(
    'select count(*) from %I.%I where %I = $1 and %I > now() - make_interval(secs => $2)',
    tg_table_schema, tg_table_name, tg_argv[0], tg_argv[1]
  )
  into recientes
  using yo, tg_argv[3]::integer;

  if recientes >= tg_argv[2]::integer then
    -- PT429: la API lo devuelve como «429 Too Many Requests».
    raise exception 'Demasiadas acciones seguidas. Espera un momento antes de continuar.'
      using errcode = 'PT429';
  end if;
  return new;
end;
$$;

revoke all on function private.limitar_frecuencia() from public, anon, authenticated;

-- Índices para que contar lo reciente de una persona no recorra toda la tabla.
drop index public.mensajes_autor_idx;
create index mensajes_autor_idx on public.mensajes (autor_id, creado desc);
create index invitaciones_grupo_invitador_reciente_idx on public.invitaciones_grupo (invitador_id, creada desc);
create index invitaciones_evento_invitador_reciente_idx on public.invitaciones_evento (invitador_id, creada desc);
create index reportes_reportante_reciente_idx on public.reportes (reportante_id, creado desc);
create index grupos_creador_reciente_idx on public.grupos (creado_por, creado desc);

-- 30 mensajes por minuto: una conversación muy viva no llega; un bot, sí.
create trigger mensajes_limite
  before insert on public.mensajes
  for each row execute function private.limitar_frecuencia('autor_id', 'creado', '30', '60');

-- 30 solicitudes de amistad por hora.
create trigger amistades_limite
  before insert on public.amistades
  for each row execute function private.limitar_frecuencia('solicitante_id', 'creada', '30', '3600');

-- 10 quedadas y 5 grupos al día.
create trigger eventos_limite
  before insert on public.eventos
  for each row execute function private.limitar_frecuencia('creador_id', 'creado', '10', '86400');

create trigger grupos_limite
  before insert on public.grupos
  for each row execute function private.limitar_frecuencia('creado_por', 'creado', '5', '86400');

-- 60 invitaciones por hora a grupos y otras tantas a quedadas.
create trigger invitaciones_grupo_limite
  before insert on public.invitaciones_grupo
  for each row execute function private.limitar_frecuencia('invitador_id', 'creada', '60', '3600');

create trigger invitaciones_evento_limite
  before insert on public.invitaciones_evento
  for each row execute function private.limitar_frecuencia('invitador_id', 'creada', '60', '3600');

-- 15 reportes por hora: reportar en masa también es una forma de acoso.
create trigger reportes_limite
  before insert on public.reportes
  for each row execute function private.limitar_frecuencia('reportante_id', 'creado', '15', '3600');
