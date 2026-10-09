import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { nivelPuntuacion } from '@/scoring/puntuacion';
import { fuentes, useTema } from '@/theme';
import { etiquetaNivel } from '@/utils/resumen';

const CirculoAnimado = Animated.createAnimatedComponent(Circle);
const SALIDA_SUAVE = Easing.bezier(0.23, 1, 0.32, 1);

interface Props {
  /** Puntuación de 0 a 100. */
  valor: number;
  tamano?: number;
  grosor?: number;
  /** Retardo en ms, para acompasarlo con la entrada de su tarjeta. */
  retardo?: number;
  /** Sobre una foto: pista y cifra en blanco. */
  sobreFoto?: boolean;
}

/** Anillo que se rellena hasta la puntuación al cargar. El color indica el tramo. */
export function AnilloPuntuacion({
  valor,
  tamano = 60,
  grosor = 6,
  retardo = 0,
  sobreFoto = false,
}: Props) {
  const { colores } = useTema();
  const quieto = useReducedMotion();
  const progreso = useSharedValue(quieto ? valor : 0);

  useEffect(() => {
    progreso.set(
      quieto
        ? valor
        : withDelay(retardo, withTiming(valor, { duration: 950, easing: SALIDA_SUAVE })),
    );
  }, [valor, quieto, retardo, progreso]);

  const radio = (tamano - grosor) / 2;
  const perimetro = 2 * Math.PI * radio;
  const propsArco = useAnimatedProps(() => ({
    strokeDashoffset: perimetro * (1 - progreso.get() / 100),
  }));

  const nivel = nivelPuntuacion(valor);
  const centro = tamano / 2;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Puntuación ${valor} de 100, ${etiquetaNivel[nivel].toLowerCase()}`}
      style={{ width: tamano, height: tamano }}>
      <Svg width={tamano} height={tamano}>
        <Circle
          cx={centro}
          cy={centro}
          r={radio}
          stroke={sobreFoto ? 'rgba(255,255,255,0.28)' : colores.borde}
          strokeWidth={grosor}
          fill={sobreFoto ? 'rgba(4,20,30,0.35)' : 'none'}
        />
        <CirculoAnimado
          cx={centro}
          cy={centro}
          r={radio}
          stroke={sobreFoto ? colores.solFijo : colores[nivel]}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={perimetro}
          animatedProps={propsArco}
          fill="none"
          rotation={-90}
          originX={centro}
          originY={centro}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, estilos.centro]}>
        <Text
          style={[
            estilos.cifra,
            { fontSize: tamano * 0.36, color: sobreFoto ? '#FFFFFF' : colores.texto },
          ]}
          allowFontScaling={false}>
          {valor}
        </Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center' },
  cifra: { fontFamily: fuentes.titular, letterSpacing: -0.5 },
});
