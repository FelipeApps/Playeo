import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Texto } from '@/components/texto';
import { espacio, useTema } from '@/theme';

type Escena = 'sin-conexion' | 'vacio' | 'extravio';

interface Props {
  escena: Escena;
  titulo: string;
  mensaje: string;
  /** Acción opcional, normalmente un botón. */
  children?: ReactNode;
}

/** Pequeña escena de mar para acompañar el mensaje: con nube, despejada o con una boya. */
function Ilustracion({ escena }: { escena: Escena }) {
  const { colores } = useTema();

  return (
    <Svg width={168} height={112} viewBox="0 0 168 112" accessibilityElementsHidden>
      <Circle cx={84} cy={50} r={40} fill={colores.arena} />
      {escena === 'extravio' ? null : (
        <Circle cx={escena === 'vacio' ? 84 : 100} cy={44} r={15} fill={colores.sol} />
      )}
      {escena === 'sin-conexion' ? (
        <Path
          d="M56 60a13 13 0 0 1 4-25 18 18 0 0 1 34 3 11 11 0 0 1 2 22z"
          fill={colores.superficie}
          stroke={colores.textoSecundario}
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
      ) : null}
      {escena === 'extravio' ? (
        <>
          <Path
            d="M84 30v34"
            stroke={colores.textoSecundario}
            strokeWidth={1.75}
            strokeLinecap="round"
          />
          <Path d="M84 30l16 6-16 6z" fill={colores.malo} />
          <Path d="M72 78l4-14h16l4 14z" fill={colores.sol} />
        </>
      ) : null}
      <Path
        d="M8 78c13 0 13-9 26-9s13 9 26 9 13-9 26-9 13 9 26 9 13-9 26-9 13 9 22 9"
        fill="none"
        stroke={colores.turquesa}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d="M24 94c11 0 11-7 22-7s11 7 22 7 11-7 22-7 11 7 22 7 11-7 22-7"
        fill="none"
        stroke={colores.primario}
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.55}
      />
    </Svg>
  );
}

/** Estados vacíos y de error: qué pasa y qué se puede hacer. */
export function EstadoVacio({ escena, titulo, mensaje, children }: Props) {
  return (
    <View style={estilos.contenedor}>
      <Ilustracion escena={escena} />
      <Texto variante="titulo" style={estilos.centrado}>
        {titulo}
      </Texto>
      <Texto color="textoSecundario" style={estilos.centrado}>
        {mensaje}
      </Texto>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
    padding: espacio.xl,
  },
  centrado: { textAlign: 'center', maxWidth: 320 },
});
