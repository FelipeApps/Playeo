import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Ola } from '@/components/ola';
import { useTema } from '@/theme';

interface Props {
  ancho: number;
  /** Altura de ola en la orilla (m). */
  altura: number | null;
  /** Segundos entre olas. */
  periodo: number | null;
  /** Segunda capa de fondo, para tarjetas grandes. */
  doble?: boolean;
}

function entre(valor: number, minimo: number, maximo: number) {
  return Math.min(maximo, Math.max(minimo, valor));
}

/**
 * Franja de mar del pie de las tarjetas. No es decoración: la altura de la onda sigue
 * la altura real de la ola y su ritmo sigue el periodo, así que un mar en calma se ve
 * plano y lento, y un mar movido se ve alto y rápido.
 */
export function FranjaMar({ ancho, altura, periodo, doble = false }: Props) {
  const { colores } = useTema();
  const quieto = useReducedMotion();

  const amplitud = entre(1.5 + (altura ?? 0.5) * 3.4, 1.5, 9);
  const ciclos = periodo != null && periodo < 7 ? 3 : 2;
  const segundos = entre((periodo ?? 8) * 1.2, 6, 15);
  const alto = amplitud * 2 + 8;

  return (
    <View pointerEvents="none" style={{ height: alto + (doble ? 6 : 0), overflow: 'hidden' }}>
      {doble ? (
        <Ola
          ancho={ancho}
          alto={alto + 6}
          amplitud={amplitud}
          ciclos={ciclos}
          fase={2}
          color={colores.turquesa}
          opacidad={0.18}
          segundos={segundos * 1.6}
          quieta={quieto}
        />
      ) : null}
      <Ola
        ancho={ancho}
        alto={alto}
        amplitud={amplitud}
        ciclos={ciclos}
        color={colores.turquesa}
        opacidad={0.32}
        segundos={segundos}
        quieta={quieto}
      />
    </View>
  );
}
