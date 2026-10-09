import type { NombreIcono } from '@/components/icono';

/**
 * De dónde sale el sitio de una actividad:
 *  - 'catalogo_con_estado': se elige un lugar del catálogo y se muestra su previsión.
 *  - 'catalogo': se elige un lugar del catálogo, sin previsión (canchas).
 *  - 'manual': quien organiza escribe el sitio.
 */
export type TipoSitio = 'catalogo_con_estado' | 'catalogo' | 'manual';

export type IdActividad =
  'playa' | 'senderismo' | 'futbol' | 'baloncesto' | 'padel' | 'baile' | 'pilates' | 'otros';

export interface Actividad {
  id: IdActividad;
  nombre: string;
  tipoSitio: TipoSitio;
  icono: NombreIcono;
  /** Cómo se llama su tipo de lugar, en plural: para títulos y estados vacíos. */
  lugares: string;
}

/**
 * Actividades de Planeo. Los id y el tipo de sitio coinciden con la tabla `actividades`
 * de la base de datos; aquí se añade lo que es solo de la app (icono y textos).
 */
export const ACTIVIDADES: Actividad[] = [
  {
    id: 'playa',
    nombre: 'Playa',
    tipoSitio: 'catalogo_con_estado',
    icono: 'sombrilla',
    lugares: 'playas',
  },
  {
    id: 'senderismo',
    nombre: 'Senderismo',
    tipoSitio: 'catalogo_con_estado',
    icono: 'senderismo',
    lugares: 'rutas',
  },
  { id: 'futbol', nombre: 'Fútbol', tipoSitio: 'catalogo', icono: 'futbol', lugares: 'campos' },
  {
    id: 'baloncesto',
    nombre: 'Baloncesto',
    tipoSitio: 'catalogo',
    icono: 'baloncesto',
    lugares: 'canchas',
  },
  { id: 'padel', nombre: 'Pádel', tipoSitio: 'catalogo', icono: 'padel', lugares: 'pistas' },
  { id: 'baile', nombre: 'Baile', tipoSitio: 'manual', icono: 'baile', lugares: 'sitios' },
  { id: 'pilates', nombre: 'Pilates', tipoSitio: 'manual', icono: 'pilates', lugares: 'sitios' },
  { id: 'otros', nombre: 'Otros', tipoSitio: 'manual', icono: 'otros', lugares: 'sitios' },
];

/** Las que tienen lugares que explorar: todas menos las de sitio escrito a mano. */
export const ACTIVIDADES_CON_CATALOGO = ACTIVIDADES.filter(
  (actividad) => actividad.tipoSitio !== 'manual',
);

export function buscarActividad(id: string | null | undefined): Actividad {
  return (
    ACTIVIDADES.find((actividad) => actividad.id === id) ?? ACTIVIDADES[ACTIVIDADES.length - 1]
  );
}
