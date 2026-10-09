import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { fuentes } from '@/theme';

/** Tirón (en puntos) a partir del cual soltar actualiza. */
const UMBRAL = 88;
/** Hueco que se mantiene abierto mientras se actualiza. */
const ALTO_ACTUALIZANDO = 76;
/** El contenido baja la mitad de lo que baja el dedo: resistencia de goma. */
const RESISTENCIA = 0.5;
const MUELLE = { duration: 420, dampingRatio: 0.85 };

type Fase = 'tirar' | 'soltar' | 'actualizando';

const TEXTO: Record<Fase, string> = {
  tirar: 'Tira para actualizar',
  soltar: 'Suelta para actualizar',
  actualizando: 'Mirando el mar…',
};

/**
 * Pull-to-refresh propio de la pantalla Hoy: al tirar hacia abajo desde arriba, el cielo
 * se abre y sale el sol. Todo el arrastre corre en el hilo de UI; a React solo llegan
 * los dos cruces del umbral y el inicio de la actualización.
 *
 * Devuelve el gesto (para envolver el ScrollView), el estilo que desplaza el contenido
 * y lo que necesita el indicador.
 */
export function useRefrescoSol(
  /** Scroll vertical del contenido: solo se puede tirar estando arriba del todo. */
  desplazamiento: SharedValue<number>,
  alRefrescar: () => Promise<void>,
) {
  const tiron = useSharedValue(0);
  const origen = useSharedValue(0);
  const ocupado = useSharedValue(false);
  const [fase, setFase] = useState<Fase>('tirar');

  const actualizar = async () => {
    setFase('actualizando');
    try {
      await alRefrescar();
    } finally {
      ocupado.set(false);
      tiron.set(withSpring(0, MUELLE));
      setFase('tirar');
    }
  };

  // Aviso háptico justo al cruzar el umbral, en un sentido o en otro.
  useAnimatedReaction(
    () => tiron.get() >= UMBRAL,
    (armado, antes) => {
      if (antes == null || armado === antes || ocupado.get()) return;
      scheduleOnRN(setFase, armado ? 'soltar' : 'tirar');
      if (armado) scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
    },
  );

  const arrastre = Gesture.Pan()
    // Solo arrastres claramente verticales: los carruseles horizontales siguen siendo suyos.
    .activeOffsetY(10)
    .failOffsetX([-18, 18])
    .onBegin(() => {
      origen.set(0);
    })
    .onUpdate((evento) => {
      if (ocupado.get()) return;
      if (desplazamiento.get() > 0) {
        // Aún hay contenido por encima: el tirón empezará a contar desde aquí.
        origen.set(evento.translationY);
        tiron.set(0);
        return;
      }
      tiron.set(Math.max(0, (evento.translationY - origen.get()) * RESISTENCIA));
    })
    .onEnd(() => {
      if (ocupado.get()) return;
      if (tiron.get() >= UMBRAL) {
        ocupado.set(true);
        tiron.set(withSpring(ALTO_ACTUALIZANDO, MUELLE));
        scheduleOnRN(actualizar);
      } else {
        tiron.set(withSpring(0, MUELLE));
      }
    });

  // El scroll nativo y el arrastre conviven: uno mueve la lista, el otro abre el cielo.
  const gesto = Gesture.Simultaneous(arrastre, Gesture.Native());

  const estiloContenido = useAnimatedStyle(() => ({
    transform: [{ translateY: tiron.get() }],
  }));

  return { gesto, estiloContenido, tiron, fase };
}

interface PropsIndicador {
  tiron: SharedValue<number>;
  fase: Fase;
  /** Color del cielo en lo alto: el hueco que se abre lo continúa. */
  cielo: string;
}

/** El sol que asoma en el hueco que deja el contenido al tirar. */
export function IndicadorSol({ tiron, fase, cielo }: PropsIndicador) {
  const insets = useSafeAreaInsets();
  const quieto = useReducedMotion();
  const giro = useSharedValue(0);
  const actualizando = fase === 'actualizando';

  // Mientras se actualiza, los rayos giran solos; al tirar, giran con el dedo.
  useAnimatedReaction(
    () => actualizando,
    (ahora, antes) => {
      if (ahora === antes) return;
      if (ahora && !quieto) {
        giro.set(
          withRepeat(
            withTiming(giro.get() + 360, {
              duration: 1600,
              easing: Easing.linear,
            }),
            -1,
          ),
        );
      } else {
        cancelAnimation(giro);
      }
    },
    [actualizando, quieto],
  );

  const estiloSol = useAnimatedStyle(() => {
    const avance = Math.min(tiron.get() / UMBRAL, 1);
    return {
      opacity: interpolate(tiron.get(), [8, 44], [0, 1], 'clamp'),
      transform: [
        // El sol sube desde el borde del contenido hasta el centro del hueco.
        { translateY: insets.top + tiron.get() / 2 - 22 + (1 - avance) * 18 },
        { scale: 0.7 + 0.3 * avance },
      ],
    };
  });
  const estiloRayos = useAnimatedStyle(() => ({
    opacity: interpolate(tiron.get(), [30, UMBRAL], [0, 1], 'clamp'),
    transform: [{ rotate: `${actualizando ? giro.get() : tiron.get() * 1.6}deg` }],
  }));

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[estilos.hueco, { backgroundColor: cielo }]}>
      <Animated.View style={[estilos.sol, estiloSol]}>
        <Animated.View style={[StyleSheet.absoluteFill, estiloRayos]}>
          <Svg width={44} height={44} viewBox="0 0 44 44">
            <Path
              d="M22 2v6M22 36v6M2 22h6M36 22h6M7.9 7.9l4.2 4.2M31.9 31.9l4.2 4.2M7.9 36.1l4.2-4.2M31.9 12.1l4.2-4.2"
              stroke="#FFD23F"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
        <Svg width={44} height={44} viewBox="0 0 44 44">
          <Circle cx={22} cy={22} r={9} fill="#FFD23F" />
        </Svg>
        <Text style={estilos.texto}>{TEXTO[fase]}</Text>
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // Fondo fijo tras el contenido; solo se ve la parte que el tirón deja al descubierto.
  hueco: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
    alignItems: 'center',
  },
  sol: { width: 44, height: 44, alignItems: 'center' },
  texto: {
    position: 'absolute',
    top: 46,
    width: 220,
    textAlign: 'center',
    fontFamily: fuentes.textoMedio,
    fontSize: 13,
    color: '#E3EEF3',
  },
});
