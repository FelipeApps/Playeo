import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G } from 'react-native-svg';

import { Icono } from '@/components/icono';
import { Ola } from '@/components/ola';
import { Presionable } from '@/components/presionable';
import { espacio, fuentes, useTema } from '@/theme';
import { fechaLarga } from '@/utils/etiquetas';
import { horaDecimal, progresoSolar, type Cielo } from '@/utils/luz';

/** Alto del horizonte sin contar la barra de estado. */
export const ALTO_HORIZONTE = 280;

const LADO_ASTRO = 150;
const ESTRELLAS = [
  [0.12, 0.2, 1.2],
  [0.3, 0.42, 0.9],
  [0.46, 0.14, 1.4],
  [0.58, 0.5, 0.8],
  [0.9, 0.36, 1.1],
  [0.7, 0.62, 0.9],
  [0.2, 0.64, 1],
] as const;

interface Props {
  /** Scroll vertical de la pantalla, para el paralaje del astro y del titular. */
  desplazamiento: SharedValue<number>;
  /** Cielo de este momento: degradado y astro según la hora, las nubes y la calima. */
  cielo: Cielo;
  /** Momento que representa el horizonte. */
  ahora: Date;
  /** Titular del horizonte. */
  pregunta: string;
  /** Nombre de la zona elegida; al tocarlo se abre el selector. */
  zona: string;
  alCambiarZona: () => void;
  /** Avisos sin leer; la campana solo se muestra con sesión iniciada. */
  avisos?: number;
  alAbrirAvisos?: () => void;
}

/**
 * Cabecera de Hoy: el cielo de este momento sobre el mar.
 * El degradado y el astro salen de la hora y del tiempo real; la altura del astro, de la hora.
 */
export function Horizonte({
  desplazamiento,
  cielo,
  ahora,
  pregunta,
  zona,
  alCambiarZona,
  avisos = 0,
  alAbrirAvisos,
}: Props) {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const { width: ancho } = useWindowDimensions();
  const quieto = useReducedMotion();
  const progreso = progresoSolar(horaDecimal(ahora));
  const deNoche = cielo.astro === 'luna';
  const alto = insets.top + ALTO_HORIZONTE;

  // El astro se mueve por la mitad derecha; el titular ocupa la izquierda.
  const cima = insets.top + 62;
  const ras = alto - 96;
  const centroX = ancho * (0.68 + 0.18 * (progreso ?? 0.5));
  const centroY = progreso == null ? cima + 14 : ras - Math.sin(Math.PI * progreso) * (ras - cima);

  const estiloAstro = useAnimatedStyle(() => ({
    transform: [{ translateY: desplazamiento.get() * 0.35 }],
  }));
  const estiloTexto = useAnimatedStyle(() => ({
    opacity: interpolate(desplazamiento.get(), [0, 150], [1, 0], 'clamp'),
    transform: [{ translateY: desplazamiento.get() * 0.18 }],
  }));

  return (
    <View style={[estilos.contenedor, { minHeight: alto }]}>
      <LinearGradient
        colors={cielo.colores}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />

      {deNoche ? (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {ESTRELLAS.map(([x, y, r], indice) => (
            <Circle key={indice} cx={ancho * x} cy={alto * y} r={r} fill="#FFFFFF" opacity={0.7} />
          ))}
        </Svg>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[
          estilos.astro,
          { left: centroX - LADO_ASTRO / 2, top: centroY - LADO_ASTRO / 2 },
          quieto ? null : estiloAstro,
        ]}>
        <Svg width={LADO_ASTRO} height={LADO_ASTRO} viewBox="0 0 150 150">
          {deNoche ? (
            <>
              <Circle cx={75} cy={75} r={44} fill="#DCE9F0" opacity={0.08} />
              <Circle cx={75} cy={75} r={24} fill="#E8F0F4" />
              <Circle cx={86} cy={68} r={21} fill={cielo.colores[0]} />
            </>
          ) : cielo.astro === 'sol-calima' ? (
            // Con calima el sol se ve como un disco pálido, sin brillo alrededor.
            <>
              <Circle cx={75} cy={75} r={46} fill="#F6E7C6" opacity={0.14} />
              <Circle cx={75} cy={75} r={30} fill="#F6E7C6" opacity={0.85} />
            </>
          ) : (
            <G opacity={cielo.astro === 'sol-velado' ? 0.5 : 1}>
              <Circle cx={75} cy={75} r={72} fill="#FFD23F" opacity={0.1} />
              <Circle cx={75} cy={75} r={52} fill="#FFD23F" opacity={0.18} />
              <Circle cx={75} cy={75} r={32} fill="#FFD23F" />
            </G>
          )}
        </Svg>
      </Animated.View>

      <Ola
        ancho={ancho}
        alto={74}
        amplitud={9}
        ciclos={1}
        color="#FFFFFF"
        opacidad={0.2}
        segundos={22}
        quieta={quieto}
      />
      <Ola
        ancho={ancho}
        alto={56}
        amplitud={7}
        ciclos={2}
        fase={1.4}
        color={colores.fondo}
        opacidad={0.55}
        segundos={15}
        quieta={quieto}
      />
      <Ola
        ancho={ancho}
        alto={38}
        amplitud={5}
        ciclos={2}
        fase={3.1}
        color={colores.fondo}
        segundos={10}
        quieta={quieto}
      />

      <Animated.View
        style={[
          estilos.texto,
          { paddingTop: insets.top + espacio.m },
          quieto ? null : estiloTexto,
        ]}>
        <View style={estilos.cabecera}>
          <View style={estilos.marca}>
            <View style={estilos.puntoMarca} />
            <Text style={estilos.nombreMarca}>Planeo</Text>
          </View>
          <View style={estilos.acciones}>
            {alAbrirAvisos ? (
              <Presionable
                accessibilityLabel={avisos > 0 ? `Avisos: ${avisos} sin leer` : 'Avisos'}
                hitSlop={8}
                onPress={alAbrirAvisos}
                style={estilos.campana}>
                <Feather name="bell" size={18} color="#FFFFFF" />
                {avisos > 0 ? (
                  <View style={estilos.globo}>
                    <Text style={estilos.cifra} allowFontScaling={false}>
                      {avisos > 9 ? '9+' : avisos}
                    </Text>
                  </View>
                ) : null}
              </Presionable>
            ) : null}
            <Presionable
              accessibilityLabel={`Zona: ${zona}`}
              accessibilityHint="Abre el selector de zona"
              hitSlop={8}
              onPress={alCambiarZona}
              style={estilos.zona}>
              <Icono nombre="ubicacion" tamano={16} color="#FFFFFF" />
              <Text style={estilos.textoZona} numberOfLines={1}>
                {zona}
              </Text>
              <Feather name="chevron-down" size={16} color="#FFFFFF" />
            </Presionable>
          </View>
        </View>
        <View style={estilos.titular}>
          <Text style={estilos.fecha}>{fechaLarga(ahora)}</Text>
          <Text style={estilos.pregunta} accessibilityRole="header">
            {pregunta}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { overflow: 'hidden' },
  astro: { position: 'absolute', width: LADO_ASTRO, height: LADO_ASTRO },
  texto: {
    flex: 1,
    paddingHorizontal: espacio.l,
    paddingBottom: 92,
    justifyContent: 'space-between',
    gap: espacio.l,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio.s,
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  acciones: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    flexShrink: 1,
  },
  campana: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,20,30,0.32)',
  },
  globo: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD23F',
  },
  cifra: { fontFamily: fuentes.textoFuerte, fontSize: 11, color: '#3A2A00' },
  zona: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xxs + 2,
    minHeight: 40,
    maxWidth: 190,
    paddingHorizontal: espacio.s,
    borderRadius: 20,
    backgroundColor: 'rgba(4,20,30,0.32)',
  },
  textoZona: {
    flexShrink: 1,
    fontFamily: fuentes.textoFuerte,
    fontSize: 14,
    color: '#FFFFFF',
  },
  puntoMarca: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD23F',
  },
  nombreMarca: {
    fontFamily: fuentes.titulo,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  titular: { maxWidth: '64%', gap: espacio.xxs },
  fecha: {
    fontFamily: fuentes.textoMedio,
    fontSize: 15,
    lineHeight: 20,
    color: '#E3EEF3',
  },
  pregunta: {
    fontFamily: fuentes.titular,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: '#FFFFFF',
  },
});
