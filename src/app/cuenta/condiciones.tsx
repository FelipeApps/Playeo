import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton } from '@/components/boton';
import { useBarraEstado } from '@/components/pantalla';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { TEXTOS_LEGALES, type BloqueLegal, type DocumentoLegal } from '@/data/textos-legales';
import { aceptarCondiciones } from '@/sesion/condiciones';
import { espacio, fuentes, useTema } from '@/theme';

const TITULOS: Record<DocumentoLegal, string> = {
  condiciones: 'Términos y normas',
  privacidad: 'Privacidad',
  aviso: 'Aviso legal y créditos',
};

/** Cuánto puede faltar para el final y darlo por leído. */
const MARGEN_FINAL = 32;

function Bloque({ bloque }: { bloque: BloqueLegal }) {
  const { colores } = useTema();
  switch (bloque.tipo) {
    case 'titulo':
      return (
        <Texto variante="titular" accessibilityRole="header" style={estilos.titulo}>
          {bloque.texto}
        </Texto>
      );
    case 'h2':
      return (
        <Texto variante="subtitulo" accessibilityRole="header" style={estilos.apartado}>
          {bloque.texto}
        </Texto>
      );
    case 'h3':
      return (
        <Texto variante="cuerpoFuerte" accessibilityRole="header" style={estilos.subapartado}>
          {bloque.texto}
        </Texto>
      );
    case 'li':
      return (
        <View style={estilos.punto}>
          <Text style={[estilos.vineta, { color: colores.textoSecundario }]}>•</Text>
          <Texto style={estilos.flexible}>{bloque.texto}</Texto>
        </View>
      );
    default:
      return <Texto>{bloque.texto}</Texto>;
  }
}

/**
 * Lectura de un texto legal. Con `aceptar`, el botón de aceptar solo se activa al llegar
 * al final: no se puede aceptar sin haber pasado por todo el texto.
 */
export default function PantallaCondiciones() {
  const { doc, aceptar } = useLocalSearchParams<{ doc?: DocumentoLegal; aceptar?: string }>();
  const documento: DocumentoLegal = doc && doc in TEXTOS_LEGALES ? doc : 'condiciones';
  const pideAceptar = aceptar === '1';
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const [leido, setLeido] = useState(false);
  const [altoVisible, setAltoVisible] = useState(0);
  useBarraEstado('tema');

  const alDesplazar = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (leido) return;
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - MARGEN_FINAL) {
      setLeido(true);
    }
  };

  // Un texto que cabe entero en pantalla no se puede desplazar: se da por leído.
  const alMedirContenido = (_ancho: number, alto: number) => {
    if (!leido && altoVisible > 0 && alto <= altoVisible + MARGEN_FINAL) setLeido(true);
  };

  const confirmar = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    aceptarCondiciones();
    router.back();
  };

  return (
    <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <View
        style={[
          estilos.barra,
          { paddingTop: insets.top + espacio.xs, borderBottomColor: colores.borde },
        ]}>
        <Texto variante="subtitulo" style={estilos.flexible} numberOfLines={1}>
          {TITULOS[documento]}
        </Texto>
        <Presionable
          accessibilityLabel="Cerrar"
          hitSlop={8}
          onPress={() => router.back()}
          style={[estilos.cerrar, { backgroundColor: colores.superficie }]}>
          <Feather name="x" size={22} color={colores.texto} />
        </Presionable>
      </View>

      <ScrollView
        onScroll={alDesplazar}
        scrollEventThrottle={100}
        onLayout={(evento: LayoutChangeEvent) => setAltoVisible(evento.nativeEvent.layout.height)}
        onContentSizeChange={alMedirContenido}
        contentContainerStyle={[
          estilos.contenido,
          { paddingBottom: pideAceptar ? espacio.l : insets.bottom + espacio.xl },
        ]}>
        {TEXTOS_LEGALES[documento].map((bloque, indice) => (
          <Bloque key={indice} bloque={bloque} />
        ))}
      </ScrollView>

      {pideAceptar ? (
        <View
          style={[
            estilos.pie,
            {
              paddingBottom: insets.bottom + espacio.s,
              backgroundColor: colores.superficie,
              borderTopColor: colores.borde,
            },
          ]}>
          <Texto
            variante="detalle"
            color="textoSecundario"
            accessibilityLiveRegion="polite"
            style={estilos.centrado}>
            {leido
              ? 'Has llegado al final. Ya puedes aceptar.'
              : 'Lee hasta el final para poder aceptar.'}
          </Texto>
          <Boton
            titulo="He leído y acepto"
            onPress={confirmar}
            deshabilitado={!leido}
            accessibilityHint={leido ? undefined : 'Se activa al llegar al final del texto'}
          />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingHorizontal: espacio.m,
    paddingBottom: espacio.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cerrar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contenido: { paddingHorizontal: espacio.l, paddingTop: espacio.m, gap: espacio.s },
  titulo: { marginTop: espacio.m },
  apartado: { marginTop: espacio.m },
  subapartado: { marginTop: espacio.xs },
  punto: { flexDirection: 'row', gap: espacio.xs },
  vineta: { fontFamily: fuentes.textoFuerte, fontSize: 16, lineHeight: 24 },
  flexible: { flex: 1 },
  pie: {
    gap: espacio.xs,
    paddingHorizontal: espacio.l,
    paddingTop: espacio.s,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  centrado: { textAlign: 'center' },
});
