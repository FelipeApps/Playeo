import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CabeceraCielo } from '@/components/cabecera-cielo';
import { FotoPlaya } from '@/components/foto-playa';
import { useBarraEstado } from '@/components/pantalla';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { playasDe } from '@/data/playas';
import { GRUPOS_ZONAS } from '@/data/zonas';
import { useRegion } from '@/region/contexto';
import { espacio, fuentes, radio, sombra, useTema } from '@/theme';

/**
 * Selector de zona. Es lo primero que se ve al abrir la app por primera vez, antes de
 * cualquier playa, y se puede volver a él desde Hoy y desde Perfil.
 */
export default function PantallaZona() {
  const { colores, esOscuro } = useTema();
  const insets = useSafeAreaInsets();
  const { zona: actual, elegir } = useRegion();
  useBarraEstado('clara');

  const alElegir = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    elegir(id);
    // La primera vez no hay pantalla anterior a la que volver: se entra a Hoy.
    if (actual && router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={{ paddingBottom: insets.bottom + espacio.xl }}>
      <CabeceraCielo
        titulo="¿Dónde te mueves?"
        subtitulo={
          actual
            ? 'Cambia de zona cuando quieras.'
            : 'Elige tu zona. Podrás cambiarla cuando quieras.'
        }
        conVolver={actual != null}
      />

      <View style={estilos.contenido}>
        {GRUPOS_ZONAS.map((grupo) => (
          <View key={grupo.nombre} style={estilos.grupo}>
            <Texto variante="titulo" accessibilityRole="header">
              {grupo.nombre}
            </Texto>
            <View style={estilos.rejilla}>
              {grupo.zonas.map((zona) => {
                const activa = zona.id === actual?.id;
                const playas = playasDe(zona.id);
                // La portada de la zona es la foto de su playa más conocida.
                const portada = playas.find((playa) => playa.foto) ?? playas[0];
                return (
                  <View key={zona.id} style={estilos.celda}>
                    <Presionable
                      accessibilityLabel={`${zona.nombre}, ${playas.length} playas`}
                      accessibilityState={{ selected: activa }}
                      onPress={() => alElegir(zona.id)}
                      style={[
                        estilos.tesela,
                        sombra(esOscuro),
                        {
                          borderColor: activa ? colores.solFijo : 'transparent',
                        },
                      ]}>
                      {portada ? (
                        <FotoPlaya
                          playa={portada}
                          tamano="miniatura"
                          proporcion={1.5}
                          style={StyleSheet.absoluteFill}
                        />
                      ) : null}
                      {/* Velo para que el nombre se lea sobre cualquier foto. */}
                      <LinearGradient
                        colors={['rgba(4,20,30,0.05)', 'rgba(4,20,30,0.78)']}
                        style={StyleSheet.absoluteFill}
                      />
                      {activa ? (
                        <View style={[estilos.marca, { backgroundColor: colores.solFijo }]}>
                          <Feather name="check" size={16} color={colores.sobreSol} />
                        </View>
                      ) : null}
                      <Text style={estilos.nombre} numberOfLines={2}>
                        {zona.nombre}
                      </Text>
                      <Text style={estilos.cuenta}>{playas.length} playas</Text>
                    </Presionable>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <Texto variante="etiqueta" color="textoSecundario" style={estilos.nota}>
          Hay playas en todas las zonas. Las rutas de senderismo y las canchas cubren de momento
          solo Canarias.
        </Texto>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { paddingHorizontal: espacio.m, gap: espacio.l },
  grupo: { gap: espacio.s },
  rejilla: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -espacio.xxs,
  },
  celda: { width: '50%', padding: espacio.xxs },
  tesela: {
    height: 116,
    justifyContent: 'flex-end',
    padding: espacio.s,
    borderRadius: radio.l,
    borderWidth: 3,
    overflow: 'hidden',
  },
  marca: {
    position: 'absolute',
    top: espacio.xs,
    right: espacio.xs,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: {
    fontFamily: fuentes.titulo,
    fontSize: 18,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  cuenta: {
    fontFamily: fuentes.textoMedio,
    fontSize: 13,
    lineHeight: 18,
    color: '#E3EEF3',
  },
  nota: { textAlign: 'center', paddingHorizontal: espacio.m },
});
