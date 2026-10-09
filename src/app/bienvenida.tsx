import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CabeceraCielo } from '@/components/cabecera-cielo';
import { IlustracionActividad } from '@/components/ilustracion-actividad';
import { useBarraEstado } from '@/components/pantalla';
import { Presionable } from '@/components/presionable';
import { usePreferencias, type Interes } from '@/preferencias/contexto';
import { useRegion } from '@/region/contexto';
import { espacio, fuentes, radio, sombra, useTema } from '@/theme';

const SALIDA_SUAVE = Easing.bezier(0.23, 1, 0.32, 1);
const ALTO_OPCION = 148;

const OPCIONES: {
  valor: Interes;
  titulo: string;
  descripcion: string;
  /** Estampa que ilustra la opción. */
  estampa: string;
}[] = [
  {
    valor: 'playa',
    titulo: 'Playa',
    descripcion: 'Qué playa está mejor hoy: viento, oleaje y calima.',
    estampa: 'playa',
  },
  {
    valor: 'senderismo',
    titulo: 'Senderismo',
    descripcion: 'Rutas de tu zona y cómo está el día en el monte.',
    estampa: 'senderismo',
  },
  {
    valor: 'todo',
    titulo: 'Ver todo',
    descripcion: 'Playa, monte, canchas y cualquier plan con tu gente.',
    estampa: 'otros',
  },
];

/**
 * Lo primero que se ve al abrir la app por primera vez, antes de elegir zona: qué viene
 * a buscar la persona. Se puede cambiar después en Perfil.
 */
export default function PantallaBienvenida() {
  const { colores, esOscuro } = useTema();
  const insets = useSafeAreaInsets();
  const { preferencias, cambiar } = usePreferencias();
  const { zona } = useRegion();
  useBarraEstado('clara');

  const elegir = (interes: Interes) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cambiar({ interes });
    // La primera vez, el siguiente paso es la zona; si ya había una, se entra directamente.
    if (zona) router.replace('/');
    else router.replace('/zona');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={{ paddingBottom: insets.bottom + espacio.xl }}>
      <CabeceraCielo
        titulo="¿Qué te trae por aquí?"
        subtitulo="Así te enseñamos primero lo que te interesa. Lo puedes cambiar cuando quieras."
      />
      <View style={estilos.contenido} accessibilityRole="radiogroup">
        {OPCIONES.map((opcion, indice) => {
          const activa = opcion.valor === preferencias.interes;
          return (
            <Animated.View
              key={opcion.valor}
              entering={FadeInDown.delay(indice * 80)
                .duration(420)
                .easing(SALIDA_SUAVE)}>
              <Presionable
                accessibilityRole="radio"
                accessibilityState={{ checked: activa }}
                accessibilityLabel={`${opcion.titulo}. ${opcion.descripcion}`}
                onPress={() => elegir(opcion.valor)}
                style={[
                  estilos.opcion,
                  sombra(esOscuro),
                  { borderColor: activa ? colores.solFijo : 'transparent' },
                ]}>
                <IlustracionActividad actividad={opcion.estampa} proporcion={2.4} />
                {/* Velo lateral: deja ver el paisaje a la derecha y da contraste al texto. */}
                <LinearGradient
                  colors={['rgba(4,20,30,0.82)', 'rgba(4,20,30,0.45)', 'rgba(4,20,30,0)']}
                  locations={[0, 0.55, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={estilos.textos}>
                  <Text style={estilos.titulo}>{opcion.titulo}</Text>
                  <Text style={estilos.descripcion}>{opcion.descripcion}</Text>
                </View>
              </Presionable>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { paddingHorizontal: espacio.m, gap: espacio.s },
  opcion: {
    height: ALTO_OPCION,
    justifyContent: 'flex-end',
    borderRadius: radio.xl,
    borderWidth: 3,
    overflow: 'hidden',
  },
  textos: { maxWidth: '68%', padding: espacio.m, gap: 2 },
  titulo: {
    fontFamily: fuentes.titular,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  descripcion: { fontFamily: fuentes.textoMedio, fontSize: 15, lineHeight: 20, color: '#E3EEF3' },
});
