-- Avisos que faltaban para el día a día de una quedada y de un grupo:
--   · alguien se apunta a mi quedada            -> a quien la organiza
--   · cambia la hora o el lugar                 -> a quienes van o quizá vayan
--   · se cancela                                -> a quienes iban o quizá fueran
--   · empieza dentro de poco                    -> a quienes van
--   · alguien entra en mi grupo                 -> a quienes lo administran
-- Todos pasan por private.notificar(), así que respetan los bloqueos y salen como push.

-- Al borrar una quedada se retiran los avisos que apuntaban a ella.
create index notificaciones_evento_idx on public.notificaciones ((datos ->> 'evento_id'))
  where datos ? 'evento_id';

-- Momento en que se envió el recordatorio. Nulo = pendiente.
alter table public.eventos add column recordado timestamptz;

-- Para el barrido de recordatorios: solo las quedadas que aún no lo tienen.
create index eventos_por_recordar_idx on public.eventos (empieza) where recordado is null;

-- ---------------------------------------------------------------------------
-- Alguien se apunta
-- ---------------------------------------------------------------------------

create function private.notificar_asistencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  evento public.eventos;
begin
  -- Solo cuando pasa a «voy»: ni los «quizá» ni volver a confirmar lo mismo.
  if new.respuesta <> 'voy' or (tg_op = 'UPDATE' and old.respuesta = 'voy') then
    return new;
  end if;

  select * into evento from public.eventos where id = new.evento_id;

  -- Un solo aviso por persona y quedada, aunque cambie de idea varias veces.
  delete from public.notificaciones
  where usuario_id = evento.creador_id
    and actor_id = new.usuario_id
    and tipo = 'asistencia_evento'
    and datos ->> 'evento_id' = new.evento_id::text;

  perform private.notificar(
    evento.creador_id,
    'asistencia_evento',
    new.usuario_id,
    jsonb_build_object('evento_id', new.evento_id, 'titulo', evento.titulo)
  );
  return new;
end;
$$;

create trigger asistencias_notifican
  after insert or update of respuesta on public.asistencias_evento
  for each row execute function private.notificar_asistencia();

-- ---------------------------------------------------------------------------
-- Cambia la hora o el lugar
-- ---------------------------------------------------------------------------

-- Si cambia la hora, el recordatorio vuelve a estar pendiente.
create function private.reiniciar_recordatorio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.recordado := null;
  return new;
end;
$$;

create trigger eventos_reinician_recordatorio
  before update of empieza on public.eventos
  for each row
  when (old.empieza is distinct from new.empieza)
  execute function private.reiniciar_recordatorio();

create function private.notificar_cambio_de_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cambia_fecha boolean := old.empieza is distinct from new.empieza;
  cambia_lugar boolean := old.lugar_id is distinct from new.lugar_id
    or old.ubicacion_nombre is distinct from new.ubicacion_nombre;
  asistente record;
begin
  for asistente in
    select usuario_id from public.asistencias_evento
    where evento_id = new.id and respuesta in ('voy', 'quiza')
  loop
    -- Varios cambios seguidos dejan un único aviso, el último.
    delete from public.notificaciones
    where usuario_id = asistente.usuario_id
      and tipo = 'evento_cambiado'
      and leida is null
      and datos ->> 'evento_id' = new.id::text;

    perform private.notificar(
      asistente.usuario_id,
      'evento_cambiado',
      new.creador_id,
      jsonb_build_object(
        'evento_id', new.id,
        'titulo', new.titulo,
        'cambio', case
          when cambia_fecha and cambia_lugar then 'ambos'
          when cambia_fecha then 'fecha'
          else 'lugar'
        end
      )
    );
  end loop;
  return new;
end;
$$;

create trigger eventos_notifican_cambio
  after update of empieza, lugar_id, ubicacion_nombre on public.eventos
  for each row
  when (
    old.empieza is distinct from new.empieza
    or old.lugar_id is distinct from new.lugar_id
    or old.ubicacion_nombre is distinct from new.ubicacion_nombre
  )
  execute function private.notificar_cambio_de_evento();

-- ---------------------------------------------------------------------------
-- Se cancela
-- ---------------------------------------------------------------------------

-- Cancelar es borrar la quedada. Se avisa antes de que desaparezcan sus asistencias, y
-- solo si aún no había empezado. El aviso no lleva autor ni enlace: la quedada ya no
-- existe, y quien la organizaba puede estar borrando su cuenta en este mismo momento.
create function private.notificar_cancelacion_de_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  organizador text := (select nombre_visible from public.perfiles where id = old.creador_id);
  asistente record;
begin
  delete from public.notificaciones where datos ->> 'evento_id' = old.id::text;

  if old.empieza > now() then
    for asistente in
      select usuario_id from public.asistencias_evento
      where evento_id = old.id
        and respuesta in ('voy', 'quiza')
        and usuario_id <> old.creador_id
        -- Sin autor en el aviso, el bloqueo hay que mirarlo aquí.
        and not exists (
          select 1 from public.bloqueos b
          where (b.bloqueador_id = usuario_id and b.bloqueado_id = old.creador_id)
             or (b.bloqueador_id = old.creador_id and b.bloqueado_id = usuario_id)
        )
    loop
      perform private.notificar(
        asistente.usuario_id,
        'evento_cancelado',
        null,
        jsonb_build_object('titulo', old.titulo, 'empieza', old.empieza, 'organizador', organizador)
      );
    end loop;
  end if;
  return old;
end;
$$;

create trigger eventos_notifican_cancelacion
  before delete on public.eventos
  for each row execute function private.notificar_cancelacion_de_evento();

-- ---------------------------------------------------------------------------
-- Empieza dentro de poco
-- ---------------------------------------------------------------------------

-- Un aviso por quedada, unas dos horas antes, a quienes han dicho que van. Las creadas
-- hace menos de media hora se saltan: nadie necesita que le recuerden lo que acaba de montar.
create function private.enviar_recordatorios()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  evento record;
  total integer := 0;
begin
  for evento in
    update public.eventos
    set recordado = now()
    where recordado is null
      and empieza > now()
      and empieza <= now() + interval '2 hours'
      and creado < now() - interval '30 minutes'
    returning id, titulo, empieza
  loop
    perform private.notificar(
      a.usuario_id,
      'recordatorio_evento',
      null,
      jsonb_build_object('evento_id', evento.id, 'titulo', evento.titulo, 'empieza', evento.empieza)
    )
    from public.asistencias_evento a
    where a.evento_id = evento.id and a.respuesta = 'voy';
    total := total + 1;
  end loop;
  return total;
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'recordatorios-de-quedadas',
  '*/10 * * * *',
  $$select private.enviar_recordatorios()$$
);

-- ---------------------------------------------------------------------------
-- Alguien entra en mi grupo
-- ---------------------------------------------------------------------------

create function private.notificar_miembro_de_grupo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nombre_grupo text := (select nombre from public.grupos where id = new.grupo_id);
begin
  perform private.notificar(
    m.usuario_id,
    'miembro_grupo',
    new.usuario_id,
    jsonb_build_object('grupo_id', new.grupo_id, 'titulo', nombre_grupo)
  )
  from public.miembros_grupo m
  where m.grupo_id = new.grupo_id and m.rol = 'admin' and m.usuario_id <> new.usuario_id;
  return new;
end;
$$;

create trigger miembros_grupo_notifican
  after insert on public.miembros_grupo
  for each row execute function private.notificar_miembro_de_grupo();

revoke all on function private.notificar_asistencia() from public, anon, authenticated;
revoke all on function private.reiniciar_recordatorio() from public, anon, authenticated;
revoke all on function private.notificar_cambio_de_evento() from public, anon, authenticated;
revoke all on function private.notificar_cancelacion_de_evento() from public, anon, authenticated;
revoke all on function private.enviar_recordatorios() from public, anon, authenticated;
revoke all on function private.notificar_miembro_de_grupo() from public, anon, authenticated;
