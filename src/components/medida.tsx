import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Icono, type NombreIcono } from '@/components/icono';
import { Texto } from '@/components/texto';
import { espacio, useTema } from '@/theme';

/** Vaivén sutil de cada icono; los que no están aquí se quedan quietos. */
const VAIVEN = {
  viento: {
    ms: 1800,
    fotogramas: {
      from: { transform: [{ translateX: -1.5 }] },
      to: { transform: [{ translateX: 1.5 }] },
    },
  },
  ola: {
    ms: 2400,
    fotogramas: {
      from: { transform: [{ translateY: -1.5 }] },
      to: { transform: [{ translateY: 1.5 }] },
    },
  },
} as const;

interface Props {
  icono: NombreIcono;
  valor: string;
  /** Qué mide: "Viento", "Oleaje"... */
  etiqueta: string;
  /** En columna para la rejilla de la tarjeta destacada; en línea para las compactas. */
  disposicion?: 'columna' | 'linea';
}

/** Un dato con su icono. El viento y la ola se mecen despacio si el sistema lo permite. */
export function Medida({ icono, valor, etiqueta, disposicion = 'linea' }: Props) {
  const { colores } = useTema();
  const quieto = useReducedMotion();
  const vaiven = !quieto && (icono === 'viento' || icono === 'ola') ? VAIVEN[icono] : undefined;

  const dibujo = (
    <Animated.View
      style={
        vaiven
          ? {
              animationName: vaiven.fotogramas,
              animationDuration: vaiven.ms,
              animationIterationCount: 'infinite',
              animationDirection: 'alternate',
              animationTimingFunction: 'ease-in-out',
            }
          : undefined
      }>
      <Icono nombre={icono} tamano={disposicion === 'columna' ? 22 : 18} color={colores.primario} />
    </Animated.View>
  );

  if (disposicion === 'columna') {
    return (
      <View accessible accessibilityLabel={`${etiqueta}: ${valor}`} style={estilos.columna}>
        {dibujo}
        <Texto variante="cuerpoFuerte" numberOfLines={1}>
          {valor}
        </Texto>
        <Texto variante="etiqueta" color="textoSecundario" numberOfLines={1}>
          {etiqueta}
        </Texto>
      </View>
    );
  }

  return (
    <View accessible accessibilityLabel={`${etiqueta}: ${valor}`} style={estilos.linea}>
      {dibujo}
      <Texto variante="etiqueta" numberOfLines={1}>
        {valor}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  columna: { flex: 1, alignItems: 'center', gap: 2 },
  linea: { flexDirection: 'row', alignItems: 'center', gap: espacio.xxs + 2 },
});
