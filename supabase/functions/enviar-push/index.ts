// Envía por Expo Push una notificación ya guardada en la base de datos.
// La llama un trigger de Postgres (private.encolar_push) con el id de la notificación;
// no es para la app, así que no usa la sesión de un usuario sino un secreto compartido.
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

function responder(estado: number, cuerpo: Record<string, unknown>) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Título y texto de la push según el tipo de notificación. */
function redactar(tipo: string, actor: string, datos: Record<string, string | null>) {
  const destino = datos.titulo ?? '';
  switch (tipo) {
    case 'solicitud_amistad':
      return {
        title: 'Nueva solicitud de amistad',
        body: `${actor} quiere ser tu amigo en Planeo.`,
      };
    case 'amistad_aceptada':
      return { title: 'Solicitud aceptada', body: `${actor} y tú ya sois amigos.` };
    case 'invitacion_grupo':
      return { title: 'Te han invitado a un grupo', body: `${actor} te invita a ${destino}.` };
    case 'invitacion_evento':
      return { title: 'Te han invitado a una quedada', body: `${actor} te invita a ${destino}.` };
    case 'asistencia_evento':
      return { title: destino || 'Tu quedada', body: `${actor} se ha apuntado.` };
    case 'evento_cambiado': {
      const que =
        datos.cambio === 'fecha'
          ? 'la hora'
          : datos.cambio === 'lugar'
            ? 'el lugar'
            : 'la hora y el lugar';
      return { title: destino || 'Cambios en una quedada', body: `${actor} ha cambiado ${que}.` };
    }
    case 'evento_cancelado':
      return {
        title: 'Quedada cancelada',
        body: `${datos.organizador ?? 'Quien organizaba'} ha cancelado ${destino || 'la quedada'}.`,
      };
    case 'recordatorio_evento':
      // La hora exacta depende del huso de cada móvil: la push no la dice, la app sí.
      return { title: destino || 'Tu quedada', body: 'Empieza en menos de dos horas.' };
    case 'miembro_grupo':
      return { title: destino || 'Tu grupo', body: `${actor} se ha unido al grupo.` };
    default:
      return {
        title: destino ? `${actor} en ${destino}` : actor,
        body: datos.extracto ?? 'Tienes un mensaje nuevo.',
      };
  }
}

Deno.serve(async (peticion) => {
  if (peticion.method !== 'POST') return responder(405, { error: 'Método no permitido' });

  const secreto = Deno.env.get('PUSH_SECRETO');
  if (!secreto || peticion.headers.get('x-secreto-push') !== secreto) {
    return responder(401, { error: 'No autorizado' });
  }

  const { notificacion_id } = await peticion.json().catch(() => ({}));
  if (typeof notificacion_id !== 'number')
    return responder(400, { error: 'Falta notificacion_id' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false },
    },
  );

  const { data: notificacion } = await admin
    .from('notificaciones')
    .select('id, usuario_id, tipo, actor_id, datos, leida')
    .eq('id', notificacion_id)
    .maybeSingle();
  // Ya leída o borrada mientras tanto: no hay nada que avisar.
  if (!notificacion || notificacion.leida) return responder(200, { enviadas: 0 });

  const [{ data: actor }, { data: tokens }] = await Promise.all([
    admin.from('perfiles').select('nombre_visible').eq('id', notificacion.actor_id).maybeSingle(),
    admin.from('tokens_push').select('token').eq('usuario_id', notificacion.usuario_id),
  ]);
  if (!tokens || tokens.length === 0) return responder(200, { enviadas: 0 });

  const texto = redactar(
    notificacion.tipo,
    actor?.nombre_visible ?? 'Alguien',
    notificacion.datos ?? {},
  );
  const mensajes = tokens.map(({ token }) => ({
    to: token,
    sound: 'default',
    ...texto,
    // La app usa estos datos para abrir la pantalla correspondiente al tocar la push.
    data: { tipo: notificacion.tipo, ...notificacion.datos },
  }));

  const respuesta = await fetch(EXPO_PUSH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(mensajes),
  });
  if (!respuesta.ok) return responder(502, { error: 'Expo Push no aceptó el envío' });

  // Expo avisa de los dispositivos que ya no existen: se dan de baja para no insistir.
  const { data: recibos } = await respuesta.json();
  const caducados = (recibos ?? [])
    .map((recibo: { details?: { error?: string } }, i: number) =>
      recibo.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null,
    )
    .filter(Boolean);
  if (caducados.length > 0) await admin.from('tokens_push').delete().in('token', caducados);

  return responder(200, { enviadas: mensajes.length - caducados.length });
});
