import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { useSesion } from '@/sesion/contexto';

export type RolGrupo = Database['public']['Enums']['rol_grupo'];

/** Mismo formato que valida la base de datos: solo enlaces de invitación de WhatsApp. */
export const ENLACE_WHATSAPP =
  /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{10,64}(\?[A-Za-z0-9_=&%-]*)?$/;

/** Mis grupos, con el número de miembros y mi rol en cada uno. */
export function useMisGrupos() {
  const { sesion } = useSesion();
  return useQuery({
    queryKey: ['social', 'grupos', sesion?.user.id],
    enabled: sesion != null,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mis_grupos');
      if (error) throw error;
      return data;
    },
  });
}

export function useInvitacionesGrupo() {
  const { sesion } = useSesion();
  return useQuery({
    queryKey: ['social', 'invitaciones-grupo', sesion?.user.id],
    enabled: sesion != null,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mis_invitaciones_grupo');
      if (error) throw error;
      return data;
    },
  });
}

export function useMiembrosGrupo(grupo: string) {
  return useQuery({
    queryKey: ['social', 'grupo', grupo, 'miembros'],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('miembros_de_grupo', { grupo });
      if (error) throw error;
      return data;
    },
  });
}

/** Amigos que aún no están en el grupo ni tienen invitación. */
export function useAmigosInvitables(grupo: string) {
  return useQuery({
    queryKey: ['social', 'grupo', grupo, 'invitables'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('amigos_invitables', { grupo });
      if (error) throw error;
      return data;
    },
  });
}

export function useAccionesGrupo() {
  const { sesion } = useSesion();
  const consultas = useQueryClient();
  const yo = sesion?.user.id ?? '';
  const alTerminar = () => consultas.invalidateQueries({ queryKey: ['social'] });

  const crear = useMutation({
    mutationFn: async (grupo: { nombre: string; descripcion: string }) => {
      const { data, error } = await supabase.rpc('crear_grupo', grupo);
      if (error) throw error;
      return data;
    },
    onSettled: alTerminar,
  });

  const invitar = useMutation({
    mutationFn: async ({ grupo, usuario }: { grupo: string; usuario: string }) => {
      const { error } = await supabase
        .from('invitaciones_grupo')
        .insert({ grupo_id: grupo, invitado_id: usuario, invitador_id: yo });
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  const aceptarInvitacion = useMutation({
    mutationFn: async (grupo: string) => {
      const { error } = await supabase.rpc('aceptar_invitacion_grupo', { grupo });
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  const rechazarInvitacion = useMutation({
    mutationFn: async (grupo: string) => {
      const { error } = await supabase
        .from('invitaciones_grupo')
        .delete()
        .eq('grupo_id', grupo)
        .eq('invitado_id', yo);
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  /** Quita a un miembro: a mí mismo (salir) o, siendo administrador, a otro (expulsar). */
  const quitarMiembro = useMutation({
    mutationFn: async ({ grupo, usuario }: { grupo: string; usuario: string }) => {
      const { data, error } = await supabase
        .from('miembros_grupo')
        .delete()
        .eq('grupo_id', grupo)
        .eq('usuario_id', usuario)
        .select();
      if (error) throw error;
      // RLS no da error si no dejó borrar: simplemente no borra nada.
      if (data.length === 0) throw new Error('Sin permiso para quitar a este miembro');
    },
    onSettled: alTerminar,
  });

  const cambiarRol = useMutation({
    mutationFn: async (cambio: { grupo: string; usuario: string; rol: RolGrupo }) => {
      const { error } = await supabase
        .from('miembros_grupo')
        .update({ rol: cambio.rol })
        .eq('grupo_id', cambio.grupo)
        .eq('usuario_id', cambio.usuario);
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  const editar = useMutation({
    mutationFn: async ({
      grupo,
      ...cambios
    }: {
      grupo: string;
      nombre: string;
      descripcion: string | null;
      enlace_whatsapp: string | null;
    }) => {
      const { error } = await supabase.from('grupos').update(cambios).eq('id', grupo);
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  const eliminar = useMutation({
    mutationFn: async (grupo: string) => {
      const { error } = await supabase.from('grupos').delete().eq('id', grupo);
      if (error) throw error;
    },
    onSettled: alTerminar,
  });

  return {
    crear,
    invitar,
    aceptarInvitacion,
    rechazarInvitacion,
    quitarMiembro,
    cambiarRol,
    editar,
    eliminar,
  };
}
