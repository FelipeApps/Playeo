import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components/texto';
import { espacio, radio, sombra, useTema } from '@/theme';

interface Props {
  titulo: string;
  /** Explicación breve bajo el título. */
  descripcion?: string;
  children: ReactNode;
}

/** Bloque titulado sobre una tarjeta, para agrupar ajustes relacionados. */
export function Seccion({ titulo, descripcion, children }: Props) {
  const { colores, esOscuro } = useTema();

  return (
    <View style={estilos.seccion}>
      <View style={estilos.cabecera}>
        <Texto variante="titulo" accessibilityRole="header">
          {titulo}
        </Texto>
        {descripcion ? (
          <Texto variante="detalle" color="textoSecundario">
            {descripcion}
          </Texto>
        ) : null}
      </View>
      <View
        style={[
          estilos.tarjeta,
          sombra(esOscuro),
          { backgroundColor: colores.superficie, borderColor: colores.borde },
        ]}>
        {children}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: espacio.s },
  cabecera: { gap: 2, paddingHorizontal: espacio.xxs },
  tarjeta: {
    padding: espacio.m,
    gap: espacio.m,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
