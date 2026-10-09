import { LinearGradient } from 'expo-linear-gradient';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { espacio, radio, useTema } from '@/theme';

interface Props {
  ancho?: DimensionValue;
  alto: number;
  redondeo?: number;
  style?: StyleProp<ViewStyle>;
}

const ANCHO_BRILLO = 220;

/** Bloque de carga con un brillo que lo recorre, como luz sobre el agua. */
export function Esqueleto({ ancho = '100%', alto, redondeo = radio.s, style }: Props) {
  const { colores, esOscuro } = useTema();
  const quieto = useReducedMotion();
  const brillo = esOscuro ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.75)';

  return (
    <View
      style={[
        estilos.bloque,
        { width: ancho, height: alto, borderRadius: redondeo, backgroundColor: colores.esqueleto },
        style,
      ]}>
      {quieto ? null : (
        <Animated.View
          style={[
            estilos.brillo,
            {
              animationName: {
                from: { transform: [{ translateX: -ANCHO_BRILLO }] },
                to: { transform: [{ translateX: 420 }] },
              },
              animationDuration: 1400,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            },
          ]}>
          <LinearGradient
            colors={['transparent', brillo, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

/** Silueta del ranking mientras llegan los datos: una tarjeta destacada y varias compactas. */
export function RankingEsqueleto() {
  const { colores } = useTema();
  const marco = { backgroundColor: colores.superficie, borderColor: colores.borde };

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Cargando el estado de las playas"
      style={estilos.lista}>
      <View style={[estilos.destacada, marco]}>
        <Esqueleto alto={228} redondeo={0} />
        <View style={estilos.relleno}>
          <Esqueleto ancho="80%" alto={20} />
          <Esqueleto alto={44} />
        </View>
      </View>
      {[0, 1, 2].map((indice) => (
        <View key={indice} style={[estilos.compacta, marco]}>
          <Esqueleto ancho={92} alto={112} redondeo={radio.m} />
          <View style={estilos.lineas}>
            <Esqueleto ancho="70%" alto={22} />
            <Esqueleto ancho="45%" alto={14} />
            <Esqueleto ancho="90%" alto={14} />
            <Esqueleto ancho="60%" alto={14} />
          </View>
          <Esqueleto ancho={54} alto={54} redondeo={27} />
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { overflow: 'hidden' },
  brillo: { position: 'absolute', top: 0, bottom: 0, width: ANCHO_BRILLO },
  lista: { gap: espacio.s },
  destacada: { borderRadius: radio.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  relleno: { padding: espacio.m, gap: espacio.s },
  compacta: {
    flexDirection: 'row',
    gap: espacio.s,
    padding: espacio.s,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lineas: { flex: 1, gap: espacio.xs, paddingVertical: espacio.xxs },
});
