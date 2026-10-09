-- Marca una conversación como leída usando el reloj del servidor. Si la app enviara su
-- propia hora, un móvil con el reloj atrasado dejaría mensajes como no leídos.
create function public.marcar_conversacion_leida(conversacion uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.miembros_conversacion
  set leido_hasta = now()
  where conversacion_id = conversacion and usuario_id = (select auth.uid());
$$;

revoke all on function public.marcar_conversacion_leida(uuid) from public, anon;
grant execute on function public.marcar_conversacion_leida(uuid) to authenticated;
