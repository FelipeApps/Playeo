import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { useSesion } from '@/sesion/contexto';

export type Relacion = Database['public']['Enums']['relacion_usuario'];
export type MotivoReporte = Database['public']['Enums']['motivo_reporte'];

/** Lo mínimo para pintar a una persona en una lista. */
export interface TarjetaUsuario {
  id: string;
  nombre_usuario: string;
  nombre_visible: string;
  ruta_foto: string | null;
}

export type UsuarioConRelacion = TarjetaUsuario & { relacion: Relacion };

/** Devuelve el valor con retraso, para no lanzar una búsqueda por cada tecla. */
export function useRetardado<T>(valor: T, ms = 300): T {
  const [retardado, setRetardado] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setRetardado(valor), ms);
    return () => clearTimeout(temporizador);
  }, [valor, ms]);
  return retardado;
}

/** Amigos y solicitudes pendientes en ambos sentidos. */
export function useRelaciones() {
  const { sesion } = useSesion();
  return useQuery({
    queryKey: ['social', 'relaciones', sesion?.user.id],
    enabled: sesion != null,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mis_relaciones');
      if (error) throw error;
      return data;
    },
  });
}

export function useBuscarUsuarios(texto: string) {
  const consulta = texto.trim();
  return useQuery({
    queryKey: ['social', 'buscar', consulta],
    enabled: consulta.length >= 2,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_usuarios', { texto: consulta });
      if (error) throw error;
      return data;
    },
  });
}

/** Ficha de otra persona, o `null` si no existe o me ha bloqueado. */
export function useUsuario(id: string) {
  return useQuery({
    queryKey: ['social', 'usuario', id],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ver_usuario', { usuario: id });
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

export function useBloqueados() {
  const { sesion } = useSesion();
  return useQuery({
    queryKey: ['social', 'bloqueados', sesion?.user.id],
    enabled: sesion != null,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mis_bloqueados');
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Acciones sobre otra persona. Todas refrescan lo social al terminar: una sola acción
 * (bloquear, por ejemplo) cambia a la vez la lista de amigos, la búsqueda y la ficha.
 */
export function useAccionesSociales() {
  const { sesion } = useSesion();
  const consultas = useQueryClient();
  const yo = sesion?.user.id ?? '';
  const alTerminar = () => consultas.invalidateQueries({ queryKey: ['social'] });

  /** La fila de amistad entre los dos, la haya pedido quien la haya pedido. */
  const pareja = (otro: string) =>
    `and(solicitante_id.eq.${yo},destinatario_id.eq.${otro}),and(solicitante_id.eq.${otro},destinatario_id.eq.${yo})`;

  const solicitar = useMutation({
    mutationFn: async (otro: string) => {
      const { error } = await supabase
        .from('amistades')
        .insert({ solicitante_id: yo, destinatario_id: otro });
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  const aceptar = useMutation({
    mutationFn: async (otro: string) => {
      const { error } = await supabase
        .from('amistades')
        .update({ estado: 'aceptada' })
        .eq('solicitante_id', otro)
        .eq('destinatario_id', yo);
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  /** Rechaza una solicitud, cancela la que envié o deja de ser amigo: es borrar la fila. */
  const eliminar = useMutation({
    mutationFn: async (otro: string) => {
      const { error } = await supabase.from('amistades').delete().or(pareja(otro));
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  const bloquear = useMutation({
    mutationFn: async (otro: string) => {
      const { error } = await supabase
        .from('bloqueos')
        .insert({ bloqueador_id: yo, bloqueado_id: otro });
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  const desbloquear = useMutation({
    mutationFn: async (otro: string) => {
      const { error } = await supabase
        .from('bloqueos')
        .delete()
        .eq('bloqueador_id', yo)
        .eq('bloqueado_id', otro);
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  const reportar = useMutation({
    mutationFn: async (reporte: {
      usuario: string;
      motivo: MotivoReporte;
      detalles: string;
      /** Si se reporta un mensaje concreto: su id y una copia del texto. */
      mensaje?: number;
      contenido?: string;
    }) => {
      const { error } = await supabase.from('reportes').insert({
        reportante_id: yo,
        usuario_reportado_id: reporte.usuario,
        mensaje_id: reporte.mensaje ?? null,
        contenido: reporte.contenido ?? null,
        motivo: reporte.motivo,
        detalles: reporte.detalles.trim() || null,
      });
      if (error) throw error;
    },
  });

  return { solicitar, aceptar, eliminar, bloquear, desbloquear, reportar };
}
