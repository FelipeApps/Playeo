-- Qué pasa con una conversación directa cuando una de las dos personas bloquea a la otra.
--
-- Antes desaparecía de la lista de ambas y la bloqueada recibía un error al escribir.
-- Ahora:
--   · quien bloquea deja de verla, como hasta ahora;
--   · la persona bloqueada la conserva con su historial, pero no puede escribir. La app
--     se lo dice sin señalar a nadie: «No puedes enviar mensajes a esta conversación».
-- En los grupos y quedadas no cambia nada: ahí el bloqueo oculta los mensajes entre ambas.

create function private.he_bloqueado_a(otro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bloqueos
    where bloqueador_id = (select auth.uid()) and bloqueado_id = otro
  );
$$;

-- En una conversación directa, la persona bloqueada sigue leyendo lo que ya había. No hay
-- riesgo de que le llegue nada nuevo: con un bloqueo de por medio nadie puede escribir ahí.
create function private.conservo_historial_con(conversacion uuid, autor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.he_bloqueado_a(autor)
    and exists (
      select 1 from public.conversaciones c where c.id = conversacion and c.tipo = 'directa'
    );
$$;

revoke all on function private.he_bloqueado_a(uuid) from public, anon;
revoke all on function private.conservo_historial_con(uuid, uuid) from public, anon;
grant execute on function private.he_bloqueado_a(uuid) to authenticated;
grant execute on function private.conservo_historial_con(uuid, uuid) to authenticated;

drop policy "Leer los mensajes de mis conversaciones, sin los de bloqueados" on public.mensajes;
create policy "Leer los mensajes de mis conversaciones, sin los de bloqueados"
  on public.mensajes for select
  to authenticated
  using (
    (select private.soy_miembro_de_conversacion(conversacion_id))
    and (
      autor_id = (select auth.uid())
      or not private.hay_bloqueo_con(autor_id)
      or private.conservo_historial_con(conversacion_id, autor_id)
    )
  );

-- Las notas de voz siguen la misma regla que el mensaje que las lleva.
create or replace function private.puedo_oir_nota(ruta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mensajes m
    where m.audio_ruta = ruta
      and private.soy_miembro_de_conversacion(m.conversacion_id)
      and (
        m.autor_id = (select auth.uid())
        or not private.hay_bloqueo_con(m.autor_id)
        or private.conservo_historial_con(m.conversacion_id, m.autor_id)
      )
  );
$$;

-- La lista de chats dice además si puedo escribir en cada uno. Cambia el tipo devuelto,
-- así que hay que recrear la función.
drop function public.mis_conversaciones();

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
  no_leidos bigint,
  puedo_escribir boolean
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
    ),
    c.tipo <> 'directa' or not private.hay_bloqueo_con(otro.id)
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
      and (
        m.autor_id = (select auth.uid())
        or not private.hay_bloqueo_con(m.autor_id)
        -- Las directas que llegan hasta aquí son las que no he bloqueado yo.
        or c.tipo = 'directa'
      )
    order by m.id desc
    limit 1
  ) ultimo on true
  where yo.usuario_id = (select auth.uid())
    and (
      c.tipo <> 'directa'
      or (
        c.ultimo_mensaje is not null
        and otro.id is not null
        -- Quien bloquea deja de ver la conversación; la persona bloqueada la conserva.
        and not private.he_bloqueado_a(otro.id)
      )
    )
    -- Los chats de quedadas pasadas dejan de ocupar sitio a la semana.
    and (c.tipo <> 'evento' or ev.empieza > now() - interval '7 days')
  order by coalesce(c.ultimo_mensaje, c.creada) desc;
$$;

revoke all on function public.mis_conversaciones() from public, anon;
grant execute on function public.mis_conversaciones() to authenticated;
