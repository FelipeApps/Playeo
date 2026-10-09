import { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';

const SALIDA_SUAVE = cubicBezier(0.23, 1, 0.32, 1);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
}

/**
 * Pressable con respuesta al tocar: encoge un 3 % al apoyar el dedo y vuelve al soltar.
 * Es una transición CSS de Reanimated, así que corre en el hilo de UI.
 */
export function Presionable({ style, children, onPressIn, onPressOut, ...resto }: Props) {
  const [pulsado, setPulsado] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      pressRetentionOffset={12}
      onPressIn={(evento) => {
        setPulsado(true);
        onPressIn?.(evento);
      }}
      onPressOut={(evento) => {
        setPulsado(false);
        onPressOut?.(evento);
      }}
      {...resto}>
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: pulsado ? 0.97 : 1 }],
            transitionProperty: 'transform',
            transitionDuration: 130,
            transitionTimingFunction: SALIDA_SUAVE,
          },
        ]}>
        {children as React.ReactNode}
      </Animated.View>
    </Pressable>
  );
}
