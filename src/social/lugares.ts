import { useQuery } from '@tanstack/react-query';

import { obtenerCondiciones, type Medicion } from '@/api/open-meteo';
import type { IdActividad } from '@/data/actividades';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { usePreferencias } from '@/preferencias/contexto';
import { puntuarSenderismo } from '@/scoring/puntuacion';

/** Un lugar del catálogo servido por la base de datos: una ruta o una cancha. */
export interface Lugar {
  id: string;
  nombre: string;
  region: string;
  tipo: 'playa' | 'ruta' | 'cancha';
  actividad_id: string;
  lat: number | null;
  lon: number | null;
  datos: {
    /** Población más cercana. */
    cerca_de?: string;
    /** Rutas: longitud en kilómetros y referencia oficial ("PR GC 01"). */
    km?: number;
    referencia?: string;
    /** Canchas. */
    superficie?: string;
    iluminada?: boolean;
  };
}

const COLUMNAS = 'id, nombre, region, tipo, actividad_id, lat, lon, datos';
const UN_DIA = 24 * 60 * 60 * 1000;
/** Tope de lugares por consulta: suficiente para una isla y manejable en un mapa. */
const MAXIMO = 400;
/** Rutas a las que se pide el tiempo de una vez: Open-Meteo cuenta cada punto como una petición. */
export const RUTAS_CON_ESTADO = 30;

/**
 * Lugares de una actividad en una zona. El catálogo cambia poco: se da por bueno un día
 * entero y se guarda en disco, como el tiempo. No requiere sesión.
 */
export function useLugares(actividad: IdActividad, region: string | undefined) {
  return useQuery({
    queryKey: ['lugares', actividad, region],
    enabled: supabaseConfigurado && region != null && actividad !== 'playa',
    staleTime: UN_DIA,
    queryFn: async (): Promise<Lugar[]> => {
      const { data, error } = await supabase
        .from('lugares')
        .select(COLUMNAS)
        .eq('actividad_id', actividad)
        .eq('region', region!)
        .order('nombre')
        .limit(MAXIMO);
      if (error) throw error;
      return data as Lugar[];
    },
  });
}

export function useLugar(id: string | undefined) {
  return useQuery({
    queryKey: ['lugares', 'uno', id],
    enabled: supabaseConfigurado && id != null,
    staleTime: UN_DIA,
    queryFn: async (): Promise<Lugar | null> => {
      const { data, error } = await supabase
        .from('lugares')
        .select(COLUMNAS)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as Lugar | null;
    },
  });
}

export interface RutaPuntuada {
  ruta: Lugar;
  actual: Medicion;
  esDeDia: boolean;
  horas: Medicion[];
  total: number;
}

/**
 * Estado de hoy de un conjunto de rutas, puntuado para senderismo con mis preferencias.
 * Usa la misma integración con Open-Meteo que las playas, sin la parte del mar.
 */
export function useRutasPuntuadas(rutas: Lugar[]) {
  const { preferencias } = usePreferencias();
  const conPunto = rutas.filter((ruta) => ruta.lat != null && ruta.lon != null);
  const ids = conPunto.map((ruta) => ruta.id);

  const consulta = useQuery({
    queryKey: ['condiciones-rutas', ids],
    enabled: conPunto.length > 0,
    queryFn: ({ signal }) =>
      obtenerCondiciones(
        conPunto.map((ruta) => ({ id: ruta.id, lat: ruta.lat!, lon: ruta.lon! })),
        signal,
        false,
      ),
  });

  const puntuadas: RutaPuntuada[] = [];
  if (consulta.data) {
    for (const ruta of conPunto) {
      const condiciones = consulta.data.porPlaya[ruta.id];
      if (!condiciones) continue;
      puntuadas.push({
        ruta,
        actual: condiciones.actual,
        esDeDia: condiciones.esDeDia,
        horas: condiciones.horas,
        total: puntuarSenderismo(condiciones.actual, preferencias).total,
      });
    }
    puntuadas.sort((a, b) => b.total - a.total);
  }
  return { consulta, puntuadas };
}

/** "Cerca de Tejeda, 12,4 km" */
export function descripcionDe(lugar: Lugar): string {
  const partes: string[] = [];
  if (lugar.datos.referencia) partes.push(lugar.datos.referencia);
  if (lugar.datos.cerca_de) partes.push(`cerca de ${lugar.datos.cerca_de}`);
  if (lugar.datos.km) partes.push(`${String(lugar.datos.km).replace('.', ',')} km`);
  if (lugar.datos.iluminada) partes.push('iluminada');
  const texto = partes.join(', ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
