import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { obtenerPrevisionDia } from '@/api/open-meteo';
import { buscarPlaya } from '@/data/playas';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { usePreferencias } from '@/preferencias/contexto';
import { olaEfectiva, puntuar } from '@/scoring/puntuacion';
import { useSesion } from '@/sesion/contexto';

export type Visibilidad = Database['public']['Enums']['visibilidad_evento'];
export type Respuesta = Database['public']['Enums']['respuesta_evento'];

export const etiquetaVisibilidad: Record<Visibilidad, string> = {
  amigos: 'Solo amigos',
  grupo: 'Un grupo',
  publico: 'Público',
};

export const etiquetaRespuesta: Record<Respuesta, string> = {
  voy: 'Voy',
  quiza: 'Quizá',
  no_voy: 'No voy',
};

const formatoCuando = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
});
const formatoCuandoCorto = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** "sábado, 12 de octubre, 17:30" en la hora del móvil. */
export function cuando(iso: string | Date, corto = false): string {
  return (corto ? formatoCuandoCorto : formatoCuando).format(new Date(iso));
}

/** Próximas quedadas que puedo ver: las mías siempre y las visibles de la zona. */
export function useEventos(region: string | undefined) {
  const { sesion } = useSesion();
  return useQuery({
    queryKey: ['social', 'eventos', sesion?.user.id, region],
    enabled: sesion != null,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('eventos_visibles', { region });
      if (error) throw error;
      return data;
    },
  });
}

/** Ficha de un evento, o `null` si no existe o no puedo verlo. */
export function useEvento(id: string) {
  return useQuery({
    queryKey: ['social', 'evento', id],
    staleTime: 15 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('detalle_evento', { evento: id });
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

export function useAsistentes(id: string) {
  return useQuery({
    queryKey: ['social', 'evento', id, 'asistentes'],
    staleTime: 15 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('asistentes_evento', { evento: id });
      if (error) throw error;
      return data;
    },
  });
}

export function useAmigosInvitablesEvento(id: string) {
  return useQuery({
    queryKey: ['social', 'evento', id, 'invitables'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('amigos_invitables_evento', { evento: id });
      if (error) throw error;
      return data;
    },
  });
}

/** Cuántas horas se enseñan alrededor del evento: la anterior y las cinco siguientes. */
const HORAS_ANTES = 1;
const HORAS_DESPUES = 5;

/**
 * Previsión de la playa para el momento del evento, puntuada con mis preferencias.
 * Reutiliza la integración con Open-Meteo y la misma función de puntuación que Hoy.
 */
export function usePrevisionEvento(playaId: string | undefined, empieza: string | undefined) {
  const { preferencias } = usePreferencias();
  const playa = playaId ? buscarPlaya(playaId) : undefined;

  const consulta = useQuery({
    // No es 'social': el tiempo de una playa no es dato personal y puede ir a la caché en disco.
    queryKey: ['prevision-evento', playaId, empieza],
    enabled: playa != null && empieza != null,
    retry: false,
    queryFn: ({ signal }) => obtenerPrevisionDia(playa!, new Date(empieza!), signal),
  });

  if (!playa || !empieza || !consulta.data) return { consulta, horas: [], enElMomento: undefined };

  const resguardada = playa.caracteristicas?.resguardada ?? false;
  const inicio = new Date(empieza);
  // La serie viene en UTC: la hora del evento se busca por su prefijo "AAAA-MM-DDTHH".
  const claveInicio = inicio.toISOString().slice(0, 13);
  const indice = consulta.data.findIndex((medicion) => medicion.hora.startsWith(claveInicio));
  if (indice < 0) return { consulta, horas: [], enElMomento: undefined };

  const tramo = consulta.data.slice(Math.max(0, indice - HORAS_ANTES), indice + HORAS_DESPUES + 1);
  const horas = tramo.map((medicion) => {
    const instante = new Date(`${medicion.hora}:00Z`);
    return {
      // Se muestra en la hora del móvil, igual que la fecha del evento.
      hora: instante.getHours(),
      total: puntuar(medicion, playa.caracteristicas, preferencias).total,
      viento: medicion.viento,
      ola: olaEfectiva(medicion.olaAltura, resguardada),
      destacada: medicion.hora.startsWith(claveInicio),
    };
  });

  return { consulta, horas, enElMomento: consulta.data[indice], resguardada };
}

export function useAccionesEvento() {
  const { sesion } = useSesion();
  const consultas = useQueryClient();
  const yo = sesion?.user.id ?? '';
  const alTerminar = () => consultas.invalidateQueries({ queryKey: ['social'] });

  const crear = useMutation({
    mutationFn: async (evento: {
      playa_id: string;
      titulo: string;
      descripcion: string | null;
      empieza: string;
      plazas_maximas: number | null;
      visibilidad: Visibilidad;
      grupo_id: string | null;
      enlace_whatsapp: string | null;
    }) => {
      const { data, error } = await supabase
        .from('eventos')
        .insert({ ...evento, creador_id: yo })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSettled: alTerminar,
  });

  /** Voy, quizá o no voy. Cambia mi respuesta si ya había una; si no, la crea. */
  const responder = useMutation({
    mutationFn: async ({ evento, respuesta }: { evento: string; respuesta: Respuesta }) => {
      const cambio = await supabase
        .from('asistencias_evento')
        .update({ respuesta })
        .eq('evento_id', evento)
        .eq('usuario_id', yo)
        .select('evento_id');
      if (cambio.error) throw cambio.error;
      if (cambio.data.length > 0) return;

      const { error } = await supabase
        .from('asistencias_evento')
        .insert({ evento_id: evento, usuario_id: yo, respuesta });
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  const invitar = useMutation({
    mutationFn: async ({ evento, usuario }: { evento: string; usuario: string }) => {
      const { error } = await supabase
        .from('invitaciones_evento')
        .insert({ evento_id: evento, invitado_id: usuario, invitador_id: yo });
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  const eliminar = useMutation({
    mutationFn: async (evento: string) => {
      const { error } = await supabase.from('eventos').delete().eq('id', evento);
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  return { crear, responder, invitar, eliminar };
}
