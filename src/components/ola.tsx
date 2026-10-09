import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

/** Senoide de dos pantallas de ancho; al repetirse cada `ancho`, el bucle no tiene costura. */
function trazoOla(ancho: number, alto: number, amplitud: number, ciclos: number, fase: number) {
  const total = ancho * 2;
  let d = `M0 ${alto}`;
  for (let x = 0; x <= total; x += 6) {
    const y = amplitud + amplitud * Math.sin((2 * Math.PI * ciclos * x) / ancho + fase);
    d += ` L${x} ${y.toFixed(1)}`;
  }
  return `${d} L${total} ${alto} Z`;
}

interface Props {
  ancho: number;
  alto: number;
  amplitud: number;
  /** Crestas por ancho de pantalla. Entero, para que el bucle encaje. */
  ciclos: number;
  fase?: number;
  color: string;
  opacidad?: number;
  /** Segundos que tarda en recorrer una pantalla. */
  segundos: number;
  quieta?: boolean;
}

/** Capa de ola anclada abajo que se desplaza en bucle en el hilo de UI. */
export function Ola({
  ancho,
  alto,
  amplitud,
  ciclos,
  fase = 0,
  color,
  opacidad = 1,
  segundos,
  quieta = false,
}: Props) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        estilos.capa,
        { width: ancho * 2, height: alto },
        quieta
          ? null
          : {
              animationName: { to: { transform: [{ translateX: -ancho }] } },
              animationDuration: segundos * 1000,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
            },
      ]}>
      <Svg width={ancho * 2} height={alto}>
        <Path
          d={trazoOla(ancho, alto, amplitud, ciclos, fase)}
          fill={color}
          fillOpacity={opacidad}
        />
      </Svg>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  // -1 para que no asome una línea del cielo entre la ola y el contenido.
  capa: { position: 'absolute', left: 0, bottom: -1 },
});
