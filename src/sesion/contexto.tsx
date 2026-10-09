import type { Session } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';

import { supabase, supabaseConfigurado, type CambiosPerfil, type Perfil } from '@/lib/supabase';
import { usePreferencias, type PreferenciasApp } from '@/preferencias/contexto';
import { useRegion } from '@/region/contexto';
import { PREFERENCIAS_POR_DEFECTO } from '@/scoring/puntuacion';

interface Valor {
  sesion: Session | null;
  /** Falso mientras se recupera la sesión guardada al abrir la app. */
  lista: boolean;
}

const Contexto = createContext<Valor | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [lista, setLista] = useState(!supabaseConfigurado);
  const consultas = useQueryClient();

  useEffect(() => {
    if (!supabaseConfigurado) return;

    supabase.auth
      .getSession()
      .then(({ data }) => setSesion(data.session))
      .finally(() => setLista(true));

    const { data } = supabase.auth.onAuthStateChange((evento, nueva) => {
      setSesion(nueva);
      // Al salir no debe quedar en caché nada del usuario anterior.
      if (evento === 'SIGNED_OUT') consultas.removeQueries({ queryKey: ['social'] });
    });
    return () => data.subscription.unsubscribe();
  }, [consultas]);

  return (
    <Contexto value={{ sesion, lista }}>
      <SincronizarPerfil idUsuario={sesion?.user.id} />
      {children}
    </Contexto>
  );
}

export function useSesion() {
  const valor = use(Contexto);
  if (!valor) throw new Error('useSesion necesita un ProveedorSesion');
  return valor;
}

/** Perfil del usuario con sesión iniciada. Las claves bajo 'social' se limpian al salir. */
export function useMiPerfil() {
  const { sesion } = useSesion();
  const id = sesion?.user.id;

  return useQuery({
    queryKey: ['social', 'perfil', id],
    enabled: id != null,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Perfil> => {
      const { data, error } = await supabase.from('perfiles').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useActualizarPerfil() {
  const { sesion } = useSesion();
  const consultas = useQueryClient();
  const id = sesion?.user.id;

  return useMutation({
    mutationFn: async (cambios: CambiosPerfil): Promise<Perfil> => {
      const { data, error } = await supabase
        .from('perfiles')
        .update(cambios)
        .eq('id', id!)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (perfil) => consultas.setQueryData(['social', 'perfil', id], perfil),
  });
}

function sonIguales(a: PreferenciasApp, b: PreferenciasApp) {
  return (
    a.interes === b.interes &&
    a.plan === b.plan &&
    a.toleranciaViento === b.toleranciaViento &&
    a.sensibleCalima === b.sensibleCalima
  );
}

/**
 * Mantiene las preferencias de playa del dispositivo y las del perfil en sintonía:
 * al iniciar sesión se adoptan las del perfil (o se suben las locales si el perfil
 * aún no tiene) y, desde ahí, cada cambio local se guarda en el perfil. La zona
 * elegida en la app se copia al perfil del mismo modo.
 */
function SincronizarPerfil({ idUsuario }: { idUsuario: string | undefined }) {
  const { preferencias, cambiar } = usePreferencias();
  const { zona } = useRegion();
  const { data: perfil } = useMiPerfil();
  const actualizar = useActualizarPerfil();
  const adoptadasDe = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!idUsuario || !perfil || perfil.id !== idUsuario) return;
    const guardadas = perfil.preferencias_playa as Partial<PreferenciasApp>;

    if (adoptadasDe.current !== idUsuario) {
      adoptadasDe.current = idUsuario;
      if (guardadas.plan) {
        cambiar({ ...PREFERENCIAS_POR_DEFECTO, ...guardadas });
        return;
      }
    }
    const cambios: CambiosPerfil = {};
    if (!sonIguales({ ...PREFERENCIAS_POR_DEFECTO, ...guardadas }, preferencias)) {
      cambios.preferencias_playa = { ...preferencias };
    }
    if (zona && perfil.zona !== zona.id) cambios.zona = zona.id;
    if (Object.keys(cambios).length > 0 && !actualizar.isPending) actualizar.mutate(cambios);
    // `actualizar` y `cambiar` cambian de identidad en cada render; no deben relanzar el efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idUsuario, perfil, preferencias, zona]);

  return null;
}
