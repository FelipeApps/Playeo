import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components/texto';
import { useCondicionesAceptadas } from '@/sesion/condiciones';
import { espacio, radio, useTema } from '@/theme';

function abrir(doc: 'condiciones' | 'privacidad', aceptar: boolean) {
  Haptics.selectionAsync();
  router.push({
    pathname: '/cuenta/condiciones',
    params: aceptar ? { doc, aceptar: '1' } : { doc },
  });
}

/**
 * Aceptación de los Términos y las Normas en un formulario de alta. La casilla no se marca
 * tocándola: abre el texto, y solo queda marcada al aceptarlo tras leerlo hasta el final.
 */
export function AceptacionCondiciones() {
  const { colores } = useTema();
  const aceptadas = useCondicionesAceptadas();

  return (
    <View style={estilos.bloque}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: aceptadas }}
        accessibilityLabel="Términos de uso y Normas de la comunidad"
        accessibilityHint={
          aceptadas
            ? 'Aceptados. Toca para volver a leerlos'
            : 'Abre el texto para leerlo y aceptarlo'
        }
        onPress={() => abrir('condiciones', !aceptadas)}
        style={[
          estilos.fila,
          {
            backgroundColor: colores.superficie,
            borderColor: aceptadas ? colores.primario : colores.borde,
            borderWidth: aceptadas ? 2 : 1,
          },
        ]}>
        <View
          style={[
            estilos.caja,
            {
              borderColor: aceptadas ? colores.primario : colores.textoSecundario,
              backgroundColor: aceptadas ? colores.primario : 'transparent',
            },
          ]}>
          {aceptadas ? <Feather name="check" size={16} color={colores.sobrePrimario} /> : null}
        </View>
        <View style={estilos.textos}>
          <Texto variante="cuerpoFuerte">Términos de uso y Normas de la comunidad</Texto>
          <Texto variante="detalle" color="textoSecundario">
            {aceptadas
              ? 'Leídos y aceptados.'
              : 'Toca para leerlos. Se aceptan al final del texto.'}
          </Texto>
        </View>
        <Feather name="chevron-right" size={20} color={colores.textoSecundario} />
      </Pressable>

      <Texto variante="detalle" color="textoSecundario">
        Cómo tratamos tus datos está en la{' '}
        <Texto
          variante="detalle"
          color="primario"
          accessibilityRole="link"
          onPress={() => abrir('privacidad', false)}
          style={estilos.enlace}>
          Política de privacidad
        </Texto>
        .
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.xs },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    minHeight: 64,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderRadius: radio.m,
  },
  caja: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, gap: 2 },
  enlace: { textDecorationLine: 'underline' },
});
