-- Enlace de invitación al grupo de WhatsApp de un grupo, para que unirse sea un toque.
-- Lo pone un administrador y solo lo ven los miembros: quien tiene una invitación
-- pendiente ve el nombre del grupo, pero no el enlace hasta que acepta.

alter table public.grupos
  add column enlace_whatsapp text
  constraint enlace_whatsapp_valido check (
    -- Solo enlaces de invitación de WhatsApp: evita que se cuele cualquier otra URL.
    enlace_whatsapp ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{10,64}(\?[A-Za-z0-9_=&%-]*)?$'
  );

-- La política de lectura de grupos incluye a los invitados, así que el enlace no puede
-- viajar en la tabla: se quita el permiso de lectura de esa columna y se sirve con
-- mis_grupos(), que solo devuelve los grupos de los que ya soy miembro.
revoke select on public.grupos from authenticated;
grant select (id, nombre, descripcion, creado_por, creado, actualizado)
  on public.grupos to authenticated;
grant update (enlace_whatsapp) on public.grupos to authenticated;

drop function public.mis_grupos();

create function public.mis_grupos()
returns table (
  id uuid,
  nombre text,
  descripcion text,
  miembros bigint,
  mi_rol public.rol_grupo,
  enlace_whatsapp text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.nombre,
    g.descripcion,
    (select count(*) from public.miembros_grupo m where m.grupo_id = g.id),
    yo.rol,
    g.enlace_whatsapp
  from public.grupos g
  join public.miembros_grupo yo on yo.grupo_id = g.id and yo.usuario_id = (select auth.uid())
  order by g.nombre;
$$;

revoke all on function public.mis_grupos() from public, anon;
grant execute on function public.mis_grupos() to authenticated;
