import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espacio } from '@/theme';

interface Props {
  desplazamiento: SharedValue<number>;
  /** Scroll a partir del cual la barra ya es visible del todo. */
  umbral: number;
  /** Color del cielo que tiñe el cristal. */
  tinte: string;
  children?: ReactNode;
}

/**
 * Barra superior de cristal que aparece al hacer scroll. Continúa el cielo de la
 * cabecera, así que la barra de estado se lee siempre en claro, en ambos temas.
 * Donde el desenfoque no está disponible queda el tinte translúcido.
 */
export function BarraCristal({ desplazamiento, umbral, tinte, children }: Props) {
  const insets = useSafeAreaInsets();
  const estilo = useAnimatedStyle(() => ({
    opacity: interpolate(desplazamiento.get(), [umbral - 50, umbral], [0, 1], 'clamp'),
  }));

  return (
    <Animated.View pointerEvents="none" style={[estilos.barra, estilo]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tinte, opacity: 0.8 }]} />
      <View style={[estilos.contenido, { paddingTop: insets.top }]}>{children}</View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  barra: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  contenido: { paddingHorizontal: espacio.l },
});
