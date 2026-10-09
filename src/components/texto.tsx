import { StyleSheet, Text, type TextProps } from 'react-native';

import { fuentes, useTema, type Colores } from '@/theme';

type Variante = keyof typeof estilos;

interface Props extends TextProps {
  variante?: Variante;
  color?: keyof Colores;
}

export function Texto({ variante = 'cuerpo', color = 'texto', style, ...resto }: Props) {
  const { colores } = useTema();
  return <Text style={[estilos[variante], { color: colores[color] }, style]} {...resto} />;
}

const estilos = StyleSheet.create({
  titular: { fontFamily: fuentes.titular, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  titulo: { fontFamily: fuentes.titulo, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  subtitulo: { fontFamily: fuentes.titulo, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  cuerpo: { fontFamily: fuentes.texto, fontSize: 16, lineHeight: 24 },
  cuerpoFuerte: { fontFamily: fuentes.textoFuerte, fontSize: 16, lineHeight: 24 },
  detalle: { fontFamily: fuentes.textoMedio, fontSize: 14, lineHeight: 20 },
  etiqueta: { fontFamily: fuentes.textoFuerte, fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
});
