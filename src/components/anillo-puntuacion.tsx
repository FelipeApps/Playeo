import { useEffect } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
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
// La cifra es un TextInput no editable: es el único texto nativo cuyo contenido puede
// cambiar desde el hilo de UI, sin un render de React por cada número.
const CifraAnimada = Animated.createAnimatedComponent(TextInput);
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

/**
 * Anillo que se rellena hasta la puntuación mientras la cifra cuenta hasta su valor.
 * El color indica el tramo. Con "reducir movimiento" aparece ya en su valor final.
 */
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
  const propsCifra = useAnimatedProps(() => {
    const cifra = String(Math.round(progreso.get()));
    // `text` no está en los tipos de TextInput, pero es la propiedad nativa que lo pinta.
    return { text: cifra, defaultValue: cifra } as TextInputProps;
  });

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
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, estilos.centro]}>
        <CifraAnimada
          // Si la animación no llegara a aplicarse, queda a la vista el valor real.
          defaultValue={String(valor)}
          animatedProps={propsCifra}
          editable={false}
          allowFontScaling={false}
          underlineColorAndroid="transparent"
          accessible={false}
          importantForAccessibility="no"
          style={[
            estilos.cifra,
            { fontSize: tamano * 0.36, color: sobreFoto ? '#FFFFFF' : colores.texto },
          ]}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center' },
  cifra: {
    fontFamily: fuentes.titular,
    letterSpacing: -0.5,
    textAlign: 'center',
    // Un TextInput trae relleno propio en Android; sin él, la cifra queda centrada.
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    minWidth: '100%',
  },
});
