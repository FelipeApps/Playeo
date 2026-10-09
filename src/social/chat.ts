import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useMiPerfil, useSesion } from '@/sesion/contexto';
import { borrarNota, subirNota } from '@/social/voz';

export interface Mensaje {
  id: number;
  autor_id: string;
  cuerpo: string;
  creado: string;
  /** Solo en las notas de voz: dónde está el audio y cuánto dura. */
  audio_ruta: string | null;
  audio_duracion_ms: number | null;
}

const COLUMNAS = 'id, autor_id, cuerpo, creado, audio_ruta, audio_duracion_ms';

const MENSAJES_POR_PAGINA = 30;
/** Cada cuánto se avisa de que sigo escribiendo, como mucho. */
const RITMO_ESCRIBIENDO = 2500;
/** Cuánto dura el aviso de "escribiendo" tras la última señal recibida. */
const CADUCIDAD_ESCRIBIENDO = 4000;

type Paginas = InfiniteData<Mensaje[], number | undefined>;

function claveMensajes(conversacion: string) {
  return ['social', 'chat', conversacion, 'mensajes'];
}

/** Lista de chats con el último mensaje y los no leídos. */
export function useConversaciones() {
  const { sesion } = useSesion();
  return useQuery({
    queryKey: ['social', 'conversaciones', sesion?.user.id],
    enabled: sesion != null,
    staleTime: 15 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mis_conversaciones');
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Mantiene al día la lista de chats mientras la app está abierta: cualquier mensaje
 * nuevo que yo pueda leer (Realtime aplica RLS) refresca la lista y sus contadores.
 */
export function useEscucharChats() {
  const { sesion } = useSesion();
  const consultas = useQueryClient();
  const id = sesion?.user.id;

  useEffect(() => {
    if (!id) return;
    const canal = supabase
      .channel(`chats:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, () => {
        consultas.invalidateQueries({
          queryKey: ['social', 'conversaciones'],
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [id, consultas]);
}

/** Mensajes de una conversación, del más nuevo al más antiguo, paginados por cursor. */
export function useMensajes(conversacion: string) {
  return useInfiniteQuery({
    queryKey: claveMensajes(conversacion),
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }): Promise<Mensaje[]> => {
      let consulta = supabase
        .from('mensajes')
        .select(COLUMNAS)
        .eq('conversacion_id', conversacion)
        .order('id', { ascending: false })
        .limit(MENSAJES_POR_PAGINA);
      // Cursor: los anteriores al más antiguo que ya tengo. Sin OFFSET.
      if (pageParam != null) consulta = consulta.lt('id', pageParam);
      const { data, error } = await consulta;
      if (error) throw error;
      return data;
    },
    getNextPageParam: (ultima) =>
      ultima.length === MENSAJES_POR_PAGINA ? ultima[ultima.length - 1].id : undefined,
  });
}

/** Quién está en la conversación y hasta dónde ha leído cada uno. */
export function useParticipantes(conversacion: string) {
  return useQuery({
    queryKey: ['social', 'chat', conversacion, 'participantes'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('participantes_conversacion', {
        conversacion,
      });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Conexión en vivo de una conversación abierta:
 *  - mensajes nuevos, que se añaden a la lista sin volver a pedirla;
 *  - marcas de lectura de los demás, para el "Leído";
 *  - el aviso de "escribiendo", por un canal privado que solo admite a los miembros.
 */
export function useChatEnVivo(conversacion: string) {
  const { sesion } = useSesion();
  const { data: perfil } = useMiPerfil();
  const consultas = useQueryClient();
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const canalEscritura = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ultimoAviso = useRef(0);
  const yo = sesion?.user.id;

  useEffect(() => {
    if (!yo) return;
    let caducidad: ReturnType<typeof setTimeout> | undefined;

    const cambios = supabase
      .channel(`mensajes:${conversacion}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes',
          filter: `conversacion_id=eq.${conversacion}`,
        },
        ({ new: fila }) => {
          const nuevo = fila as Mensaje;
          agregarMensaje(consultas, conversacion, nuevo);
          // Si quien escribía ha enviado, deja de estar "escribiendo".
          if (nuevo.autor_id !== yo) setEscribiendo(null);
        },
      )
      // Al borrar, Realtime solo envía el id (la fila ya no existe y no se puede filtrar
      // por conversación): se quita de esta lista si estaba en ella.
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'mensajes' },
        ({ old }) => {
          const borrado = (old as { id?: number }).id;
          if (borrado == null) return;
          consultas.setQueryData<Paginas>(claveMensajes(conversacion), (actual) =>
            actual
              ? {
                  ...actual,
                  pages: actual.pages.map((pagina) => pagina.filter((m) => m.id !== borrado)),
                }
              : actual,
          );
          consultas.invalidateQueries({
            queryKey: ['social', 'conversaciones'],
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'miembros_conversacion',
          filter: `conversacion_id=eq.${conversacion}`,
        },
        () => {
          consultas.invalidateQueries({
            queryKey: ['social', 'chat', conversacion, 'participantes'],
          });
        },
      )
      .subscribe();

    const escritura = supabase
      .channel(`conversacion:${conversacion}`, { config: { private: true } })
      .on('broadcast', { event: 'escribiendo' }, ({ payload }) => {
        if (payload.id === yo) return;
        setEscribiendo(String(payload.nombre));
        clearTimeout(caducidad);
        caducidad = setTimeout(() => setEscribiendo(null), CADUCIDAD_ESCRIBIENDO);
      })
      .subscribe();
    canalEscritura.current = escritura;

    return () => {
      clearTimeout(caducidad);
      canalEscritura.current = null;
      supabase.removeChannel(cambios);
      supabase.removeChannel(escritura);
    };
  }, [conversacion, yo, consultas]);

  /** Llamar al teclear. Se limita sola para no enviar una señal por tecla. */
  const avisarEscribiendo = () => {
    const ahora = Date.now();
    if (!canalEscritura.current || !yo || ahora - ultimoAviso.current < RITMO_ESCRIBIENDO) return;
    ultimoAviso.current = ahora;
    canalEscritura.current.send({
      type: 'broadcast',
      event: 'escribiendo',
      payload: { id: yo, nombre: perfil?.nombre_visible ?? 'Alguien' },
    });
  };

  return { escribiendo, avisarEscribiendo };
}

/** Añade un mensaje al principio de la lista en caché, sin duplicarlo. */
function agregarMensaje(
  consultas: ReturnType<typeof useQueryClient>,
  conversacion: string,
  mensaje: Mensaje,
) {
  consultas.setQueryData<Paginas>(claveMensajes(conversacion), (actual) => {
    if (!actual) return actual;
    if (actual.pages.some((pagina) => pagina.some((m) => m.id === mensaje.id))) return actual;
    const [primera = [], ...resto] = actual.pages;
    return { ...actual, pages: [[mensaje, ...primera], ...resto] };
  });
}

export function useAccionesChat(conversacion: string) {
  const { sesion } = useSesion();
  const consultas = useQueryClient();
  const yo = sesion?.user.id ?? '';

  const enviar = useMutation({
    mutationFn: async (cuerpo: string): Promise<Mensaje> => {
      const { data, error } = await supabase
        .from('mensajes')
        .insert({ conversacion_id: conversacion, autor_id: yo, cuerpo })
        .select(COLUMNAS)
        .single();
      if (error) throw error;
      return data;
    },
    // Se pinta ya con la respuesta del servidor; si Realtime lo trae después, no se duplica.
    onSuccess: (mensaje) => {
      agregarMensaje(consultas, conversacion, mensaje);
      consultas.invalidateQueries({ queryKey: ['social', 'conversaciones'] });
    },
  });

  /** Sube la grabación y envía el mensaje que la lleva. */
  const enviarVoz = useMutation({
    mutationFn: async (nota: { uri: string; duracionMs: number }): Promise<Mensaje> => {
      const ruta = await subirNota(yo, conversacion, nota.uri);
      const { data, error } = await supabase
        .from('mensajes')
        .insert({
          conversacion_id: conversacion,
          autor_id: yo,
          // El servidor pone el texto definitivo de las notas de voz.
          cuerpo: 'Nota de voz',
          audio_ruta: ruta,
          audio_duracion_ms: Math.round(nota.duracionMs),
        })
        .select(COLUMNAS)
        .single();
      if (error) {
        // Sin mensaje, el archivo no sirve de nada: no se deja huérfano.
        await borrarNota(ruta);
        throw error;
      }
      return data;
    },
    onSuccess: (mensaje) => {
      agregarMensaje(consultas, conversacion, mensaje);
      consultas.invalidateQueries({ queryKey: ['social', 'conversaciones'] });
    },
  });

  const borrar = useMutation({
    mutationFn: async ({ id, audio_ruta }: Pick<Mensaje, 'id' | 'audio_ruta'>) => {
      const { error } = await supabase.from('mensajes').delete().eq('id', id);
      if (error) throw error;
      if (audio_ruta) await borrarNota(audio_ruta);
      return id;
    },
    onSuccess: (id) => {
      consultas.setQueryData<Paginas>(claveMensajes(conversacion), (actual) =>
        actual
          ? {
              ...actual,
              pages: actual.pages.map((pagina) => pagina.filter((m) => m.id !== id)),
            }
          : actual,
      );
      consultas.invalidateQueries({ queryKey: ['social', 'conversaciones'] });
    },
  });

  const marcarLeida = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('marcar_conversacion_leida', {
        conversacion,
      });
      if (error) throw error;
    },
    onSuccess: () => consultas.invalidateQueries({ queryKey: ['social', 'conversaciones'] }),
  });

  return { enviar, enviarVoz, borrar, marcarLeida };
}

/** Abre (o crea) la conversación directa con un amigo y devuelve su id. */
export async function abrirConversacionDirecta(otro: string): Promise<string> {
  const { data, error } = await supabase.rpc('abrir_conversacion_directa', {
    otro,
  });
  if (error) throw error;
  return data;
}

/** Id del chat de un grupo. */
export async function conversacionDeGrupo(grupo: string): Promise<string> {
  const { data, error } = await supabase
    .from('conversaciones')
    .select('id')
    .eq('grupo_id', grupo)
    .single();
  if (error) throw error;
  return data.id;
}

const formatoDia = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
});

/** "10:32" si es de hoy; "9 oct" si es anterior. */
export function momentoCorto(iso: string): string {
  const fecha = new Date(iso);
  const hoy = new Date();
  const mismoDia =
    fecha.getDate() === hoy.getDate() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getFullYear() === hoy.getFullYear();
  if (!mismoDia) return formatoDia.format(fecha);
  return `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}
