import { useQuery } from '@tanstack/react-query';

import { obtenerCondiciones, type CondicionesPlaya } from '@/api/open-meteo';
import { buscarPlaya, playasDe, type Playa } from '@/data/playas';
import { usePreferencias } from '@/preferencias/contexto';
import { useRegion } from '@/region/contexto';
import { intensidadCalima, puntuar, type Puntuacion } from '@/scoring/puntuacion';

export interface PlayaPuntuada {
  playa: Playa;
  condiciones: CondicionesPlaya;
  puntuacion: Puntuacion;
}

/**
 * Condiciones de las playas de la zona elegida. Cada zona tiene su propia entrada de
 * caché (30 min, configurada en el proveedor), así que volver a una zona ya visitada
 * no repite las peticiones. `region` permite pedir una zona distinta de la elegida,
 * por ejemplo al abrir por enlace una playa de otra zona.
 */
export function useCondiciones(region?: string) {
  const { zona } = useRegion();
  const id = region ?? zona?.id;
  const playas = playasDe(id ?? '');

  return useQuery({
    queryKey: ['condiciones', id],
    enabled: playas.length > 0,
    queryFn: ({ signal }) => obtenerCondiciones(playas, signal),
  });
}

/** Playas de la zona ordenadas de mejor a peor para las preferencias actuales. */
export function useRanking(region?: string) {
  const consulta = useCondiciones(region);
  const { zona } = useRegion();
  const playas = playasDe(region ?? zona?.id ?? '');
  const { preferencias } = usePreferencias();
  const porPlaya = consulta.data?.porPlaya;

  const ranking: PlayaPuntuada[] = [];
  if (porPlaya) {
    for (const playa of playas) {
      const condiciones = porPlaya[playa.id];
      if (!condiciones) continue;
      ranking.push({
        playa,
        condiciones,
        puntuacion: puntuar(condiciones.actual, playa.caracteristicas, preferencias),
      });
    }
    ranking.sort((a, b) => b.puntuacion.total - a.puntuacion.total);
  }

  // La calima es regional: basta con que una playa la registre para avisar.
  const calima = ranking.reduce(
    (maxima, { condiciones }) =>
      Math.max(maxima, intensidadCalima(condiciones.actual.polvo, condiciones.actual.aod)),
    0,
  );
  const polvo = ranking.reduce(
    (maximo, { condiciones }) => Math.max(maximo, condiciones.actual.polvo ?? 0),
    0,
  );
  const nubosidad =
    ranking.reduce((suma, { condiciones }) => suma + condiciones.actual.nubosidad, 0) /
    (ranking.length || 1);

  return { consulta, ranking, calima, polvo, nubosidad };
}

/** Una playa con sus condiciones y su puntuación, o `undefined` si aún no hay datos. */
export function usePlayaPuntuada(id: string): PlayaPuntuada | undefined {
  // Se usa la zona de la propia playa, no la elegida: así el detalle funciona aunque
  // se llegue por un enlace o desde una quedada de otra zona.
  return useRanking(buscarPlaya(id)?.region).ranking.find((entrada) => entrada.playa.id === id);
}
