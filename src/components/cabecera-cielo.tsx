import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ola } from '@/components/ola';
import { Presionable } from '@/components/presionable';
import { espacio, fuentes, useTema } from '@/theme';
import { cieloDe, horaDecimal } from '@/utils/luz';

interface Props {
  titulo: string;
  subtitulo?: string;
  /** Muestra la flecha de volver; para pantallas apiladas. */
  conVolver?: boolean;
  /** Contenido que cuelga del borde inferior, como la foto de perfil. */
  children?: ReactNode;
}

/**
 * Cabecera con el cielo de este momento, para las pantallas que no son Hoy.
 * Versión sobria del horizonte: mismo degradado y misma ola, sin astro ni movimiento.
 */
export function CabeceraCielo({ titulo, subtitulo, conVolver = false, children }: Props) {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const { width: ancho } = useWindowDimensions();
  const [cielo] = useState(() => cieloDe(horaDecimal(new Date())));

  return (
    <View style={estilos.contenedor}>
      <LinearGradient
        colors={cielo.colores}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Ola
        ancho={ancho}
        alto={34}
        amplitud={5}
        ciclos={2}
        color={colores.fondo}
        segundos={0}
        quieta
      />

      <View style={[estilos.contenido, { paddingTop: insets.top + espacio.s }]}>
        {conVolver ? (
          <Presionable
            accessibilityLabel="Volver"
            hitSlop={6}
            onPress={() => router.back()}
            style={estilos.volver}>
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </Presionable>
        ) : null}
        <View style={estilos.textos}>
          <Text style={estilos.titulo} accessibilityRole="header">
            {titulo}
          </Text>
          {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}
        </View>
        {children}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { overflow: 'hidden' },
  contenido: { paddingHorizontal: espacio.l, paddingBottom: 58, gap: espacio.m },
  volver: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: -espacio.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,20,30,0.3)',
  },
  textos: { gap: espacio.xxs },
  titulo: {
    fontFamily: fuentes.titular,
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -0.7,
    color: '#FFFFFF',
  },
  subtitulo: { fontFamily: fuentes.textoMedio, fontSize: 16, lineHeight: 22, color: '#E3EEF3' },
});
