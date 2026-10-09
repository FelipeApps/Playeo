import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ALTO_PESTANAS } from '@/components/pantalla';
import { Presionable } from '@/components/presionable';
import { espacio, fuentes } from '@/theme';

/** Rojo de emergencia. No cambia con el tema: tiene que reconocerse siempre igual. */
export const ROJO_EMERGENCIA = '#C4301C';

const TAMANO = 52;

/**
 * Botón de emergencia que flota sobre todas las pestañas. Solo abre la pantalla de
 * emergencia: no llama ni envía nada por sí mismo, así que un toque sin querer no hace daño.
 */
export function BotonEmergencia() {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        estilos.ancla,
        { bottom: insets.bottom + ALTO_PESTANAS + espacio.s, right: insets.right + espacio.m },
      ]}>
      <Presionable
        accessibilityLabel="Emergencia"
        accessibilityHint="Abre las opciones para llamar al 112 o avisar a tu contacto de confianza"
        hitSlop={6}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/emergencia');
        }}
        style={estilos.boton}>
        <Text style={estilos.texto} allowFontScaling={false}>
          SOS
        </Text>
      </Presionable>
    </View>
  );
}

const estilos = StyleSheet.create({
  ancla: { position: 'absolute' },
  boton: {
    width: TAMANO,
    height: TAMANO,
    borderRadius: TAMANO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ROJO_EMERGENCIA,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    boxShadow: '0 6px 16px rgba(120, 20, 8, 0.35)',
  },
  texto: { fontFamily: fuentes.titular, fontSize: 15, letterSpacing: 0.4, color: '#FFFFFF' },
});
