import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { useSesion } from '@/sesion/contexto';

export type TipoNotificacion = Database['public']['Enums']['tipo_notificacion'];

export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  actor_id: string | null;
  actor_nombre: string | null;
  actor_foto: string | null;
  datos: {
    grupo_id?: string;
    evento_id?: string;
    conversacion_id?: string;
    titulo?: string | null;
    extracto?: string;
    /** En los cambios de una quedada: qué ha cambiado. */
    cambio?: 'fecha' | 'lugar' | 'ambos';
    /** En recordatorios y cancelaciones: cuándo empieza (o empezaba). */
    empieza?: string;
    /** En las cancelaciones: quién organizaba, porque el aviso ya no tiene autor. */
    organizador?: string | null;
  };
  leida: string | null;
  creada: string;
}

const CLAVE_TOKEN = 'planeo/token-push';

const QUE_CAMBIA = { fecha: 'la hora', lugar: 'el lugar', ambos: 'la hora y el lugar' } as const;

/** "18:30" en la hora del móvil. */
function horaDe(iso: string): string {
  const fecha = new Date(iso);
  return `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

/** Frase de la notificación, tal como se lee en el centro de notificaciones. */
export function textoDe(notificacion: Notificacion): string {
  const quien = notificacion.actor_nombre ?? 'Alguien';
  const destino = notificacion.datos.titulo;
  switch (notificacion.tipo) {
    case 'solicitud_amistad':
      return `${quien} quiere ser tu amigo.`;
    case 'amistad_aceptada':
      return `${quien} ha aceptado tu solicitud. Ya sois amigos.`;
    case 'invitacion_grupo':
      return `${quien} te invita al grupo ${destino ?? ''}.`.replace(' .', '.');
    case 'invitacion_evento':
      return `${quien} te invita a la quedada ${destino ?? ''}.`.replace(' .', '.');
    case 'mensaje_nuevo':
      return destino
        ? `Mensajes nuevos de ${quien} en ${destino}.`
        : `Mensajes nuevos de ${quien}.`;
    case 'asistencia_evento':
      return `${quien} se ha apuntado a ${destino ?? 'tu quedada'}.`;
    case 'evento_cambiado':
      return `${quien} ha cambiado ${QUE_CAMBIA[notificacion.datos.cambio ?? 'ambos']} de ${destino ?? 'una quedada'}.`;
    case 'evento_cancelado':
      return `${notificacion.datos.organizador ?? 'Quien organizaba'} ha cancelado ${destino ?? 'una quedada'}.`;
    case 'recordatorio_evento':
      return notificacion.datos.empieza
        ? `${destino ?? 'Tu quedada'} empieza a las ${horaDe(notificacion.datos.empieza)}.`
        : `${destino ?? 'Tu quedada'} empieza pronto.`;
    case 'miembro_grupo':
      return `${quien} se ha unido a ${destino ?? 'tu grupo'}.`;
  }
}

/** Pantalla a la que lleva una notificación (o los datos de una push) al tocarla. */
export function destinoDe(
  tipo: TipoNotificacion,
  datos: Notificacion['datos'],
  actor: string | null,
): Href {
  if (tipo === 'mensaje_nuevo' && datos.conversacion_id) {
    return { pathname: '/chat/[id]', params: { id: datos.conversacion_id } };
  }
  // Todo lo que habla de una quedada que sigue existiendo lleva a su ficha.
  if (datos.evento_id) {
    return { pathname: '/evento/[id]', params: { id: datos.evento_id } };
  }
  if (tipo === 'evento_cancelado' || tipo === 'recordatorio_evento') return '/quedadas';
  if (tipo === 'miembro_grupo' && datos.grupo_id) {
    return { pathname: '/grupos/[id]', params: { id: datos.grupo_id } };
  }
  if (tipo === 'invitacion_grupo') return '/grupos';
  if (tipo === 'amistad_aceptada' && actor) {
    return { pathname: '/usuario/[id]', params: { id: actor } };
  }
  return '/amigos';
}

export function useNotificaciones() {
  const { sesion } = useSesion();
  return useQuery({
    queryKey: ['social', 'notificaciones', sesion?.user.id],
    enabled: sesion != null,
    staleTime: 15 * 1000,
    queryFn: async (): Promise<Notificacion[]> => {
      const { data, error } = await supabase.rpc('mis_notificaciones');
      if (error) throw error;
      return data as Notificacion[];
    },
  });
}

/**
 * Con la app abierta, las notificaciones llegan en vivo: una nueva (o una de mensajes
 * que se actualiza) refresca el centro de notificaciones y lo que dependa de ella.
 */
export function useEscucharNotificaciones() {
  const { sesion } = useSesion();
  const consultas = useQueryClient();
  const id = sesion?.user.id;

  useEffect(() => {
    if (!id) return;
    const canal = supabase
      .channel(`notificaciones:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${id}` },
        ({ new: fila }) => {
          consultas.invalidateQueries({ queryKey: ['social', 'notificaciones'] });
          // Una solicitud o una invitación nueva cambia también esas listas.
          const tipo = (fila as { tipo?: TipoNotificacion }).tipo;
          if (tipo && tipo !== 'mensaje_nuevo') {
            consultas.invalidateQueries({ queryKey: ['social', 'relaciones'] });
            consultas.invalidateQueries({ queryKey: ['social', 'invitaciones-grupo'] });
            consultas.invalidateQueries({ queryKey: ['social', 'eventos'] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [id, consultas]);
}

export function useAccionesNotificaciones() {
  const { sesion } = useSesion();
  const consultas = useQueryClient();
  const yo = sesion?.user.id ?? '';
  const alTerminar = () => consultas.invalidateQueries({ queryKey: ['social', 'notificaciones'] });

  const marcarLeida = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  const marcarTodas = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: new Date().toISOString() })
        .eq('usuario_id', yo)
        .is('leida', null);
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  return { marcarLeida, marcarTodas };
}

export type EstadoPush = 'activado' | 'expo-go' | 'simulador' | 'sin-proyecto' | 'sin-permiso';

/**
 * Registra este dispositivo para recibir push. Devuelve por qué no se pudo, si es el caso.
 * `pedirPermiso` a false solo registra si el permiso ya estaba concedido, para poder
 * llamarlo al iniciar sesión sin mostrar ningún diálogo.
 *
 * Expo Go no recibe push remotas: ahí no se carga siquiera la librería (importarla en
 * Expo Go para Android da error). Hace falta una build de desarrollo o de tienda.
 */
export async function registrarDispositivo(pedirPermiso: boolean): Promise<EstadoPush> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expo-go';
  if (!Device.isDevice) return 'simulador';
  const proyecto: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!proyecto) return 'sin-proyecto';

  const Notifications = await import('expo-notifications');
  let { granted: concedido } = await Notifications.getPermissionsAsync();
  if (!concedido && pedirPermiso) {
    ({ granted: concedido } = await Notifications.requestPermissionsAsync());
  }
  if (!concedido) return 'sin-permiso';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Avisos de Planeo',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: proyecto });
  const { error } = await supabase.rpc('registrar_token_push', {
    token,
    plataforma: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  if (error) throw error;
  await AsyncStorage.setItem(CLAVE_TOKEN, token);
  return 'activado';
}

/** Da de baja este dispositivo. Se llama antes de cerrar sesión. */
export async function darDeBajaDispositivo(): Promise<void> {
  const token = await AsyncStorage.getItem(CLAVE_TOKEN);
  if (!token) return;
  await supabase.from('tokens_push').delete().eq('token', token);
  await AsyncStorage.removeItem(CLAVE_TOKEN);
}

/**
 * Al tocar una push se abre la pantalla que corresponde. Solo tiene efecto en builds
 * propias; en Expo Go no hay push que tocar.
 */
export function useAbrirDesdePush() {
  useEffect(() => {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
    let cancelar: (() => void) | undefined;
    let desmontado = false;

    import('expo-notifications').then((Notifications) => {
      if (desmontado) return;
      const suscripcion = Notifications.addNotificationResponseReceivedListener((respuesta) => {
        const datos = respuesta.notification.request.content.data as Notificacion['datos'] & {
          tipo?: TipoNotificacion;
        };
        if (datos.tipo) router.push(destinoDe(datos.tipo, datos, null));
      });
      cancelar = () => suscripcion.remove();
    });

    return () => {
      desmontado = true;
      cancelar?.();
    };
  }, []);
}
