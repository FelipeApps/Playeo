-- Tipos nuevos de aviso. Van en su propia migración porque un valor recién añadido a un
-- enum no se puede usar dentro de la misma transacción que lo crea.

alter type public.tipo_notificacion add value if not exists 'asistencia_evento';
alter type public.tipo_notificacion add value if not exists 'evento_cambiado';
alter type public.tipo_notificacion add value if not exists 'evento_cancelado';
alter type public.tipo_notificacion add value if not exists 'recordatorio_evento';
alter type public.tipo_notificacion add value if not exists 'miembro_grupo';
