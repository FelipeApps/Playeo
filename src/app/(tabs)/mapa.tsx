import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Animated, { Easing, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnilloPuntuacion } from '@/components/anillo-puntuacion';
import { FotoPlaya } from '@/components/foto-playa';
import { ALTO_PESTANAS, useBarraEstado } from '@/components/pantalla';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { buscarPlaya, lugarDe, playasDe } from '@/data/playas';
import { encuadre } from '@/data/zonas';
import { useRegion } from '@/region/contexto';
import { useRanking } from '@/hooks/use-ranking';
import { nivelPuntuacion } from '@/scoring/puntuacion';
import { espacio, radio, sombra, useTema } from '@/theme';

const SALIDA_SUAVE = Easing.bezier(0.23, 1, 0.32, 1);

export default function PantallaMapa() {
  const { colores, esOscuro } = useTema();
  const insets = useSafeAreaInsets();
  const { zona } = useRegion();
  const playas = playasDe(zona?.id ?? '');
  const [idSeleccionada, setIdSeleccionada] = useState<string | null>(null);
  const seleccionada = idSeleccionada ? buscarPlaya(idSeleccionada) : undefined;
  const { ranking } = useRanking();
  const puntos = new Map(ranking.map((entrada) => [entrada.playa.id, entrada.puntuacion.total]));
  const puntosSeleccionada = seleccionada ? puntos.get(seleccionada.id) : undefined;
  useBarraEstado('tema');

  return (
    <View style={[estilos.contenedor, { backgroundColor: colores.fondo }]}>
      <MapView
        // Al cambiar de zona el mapa se monta de nuevo con su encuadre.
        key={zona?.id}
        style={estilos.mapa}
        initialRegion={encuadre(playas)}
        userInterfaceStyle={esOscuro ? 'dark' : 'light'}
        toolbarEnabled={false}
        showsCompass={false}
        onPress={(evento) => {
          if (evento.nativeEvent.action !== 'marker-press') setIdSeleccionada(null);
        }}>
        {playas.map((playa) => {
          const activa = playa.id === idSeleccionada;
          const total = puntos.get(playa.id);
          // Color según la puntuación; azul neutro mientras no hay datos.
          const color = total == null ? colores.primario : colores[nivelPuntuacion(total)];
          return (
            <Marker
              key={playa.id}
              coordinate={{ latitude: playa.lat, longitude: playa.lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={activa ? 2 : 1}
              accessibilityLabel={`${playa.nombre}${total == null ? '' : `, puntuación ${total} de 100`}`}
              onPress={() => {
                Haptics.selectionAsync();
                setIdSeleccionada(playa.id);
              }}>
              {/* El área táctil es mayor que el punto visible. */}
              <View style={estilos.zonaTactil}>
                <View
                  style={[
                    estilos.punto,
                    { backgroundColor: color, borderColor: colores.superficie },
                    activa && estilos.puntoActivo,
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View
        pointerEvents="none"
        style={[
          estilos.rotulo,
          sombra(esOscuro),
          { top: insets.top + espacio.s, backgroundColor: colores.superficie },
        ]}>
        <Texto variante="cuerpoFuerte" accessibilityRole="header">
          {zona?.nombre}
        </Texto>
        <Texto variante="detalle" color="textoSecundario">
          {playas.length} playas
        </Texto>
      </View>

      <View
        pointerEvents="box-none"
        style={[estilos.pie, { bottom: insets.bottom + ALTO_PESTANAS + espacio.s }]}>
        {seleccionada ? (
          <Animated.View
            key={seleccionada.id}
            entering={FadeInDown.duration(260).easing(SALIDA_SUAVE)}
            exiting={FadeOutDown.duration(160)}>
            <Presionable
              accessibilityLabel={`${seleccionada.nombre}, ${lugarDe(seleccionada)}`}
              accessibilityHint="Abre el detalle de la playa"
              onPress={() =>
                router.push({ pathname: '/playa/[id]', params: { id: seleccionada.id } })
              }
              style={[
                estilos.tarjeta,
                sombra(esOscuro),
                { backgroundColor: colores.superficie, borderColor: colores.borde },
              ]}>
              <FotoPlaya playa={seleccionada} tamano="miniatura" proporcion={0.99} style={estilos.estampa} />
              <View style={estilos.textos}>
                <Texto variante="subtitulo" numberOfLines={1}>
                  {seleccionada.nombre}
                </Texto>
                <Texto variante="detalle" color="textoSecundario" numberOfLines={1}>
                  {lugarDe(seleccionada)}
                </Texto>
              </View>
              {puntosSeleccionada == null ? null : (
                <AnilloPuntuacion valor={puntosSeleccionada} tamano={52} grosor={5} />
              )}
            </Presionable>
          </Animated.View>
        ) : (
          <View style={[estilos.pista, sombra(esOscuro), { backgroundColor: colores.superficie }]}>
            <Texto variante="detalle" color="textoSecundario">
              Toca un punto para ver la playa
            </Texto>
          </View>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1 },
  mapa: { flex: 1 },
  zonaTactil: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  punto: { width: 20, height: 20, borderRadius: 10, borderWidth: 3 },
  puntoActivo: { width: 30, height: 30, borderRadius: 15, borderWidth: 4 },
  rotulo: {
    position: 'absolute',
    left: espacio.m,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: espacio.xs,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderRadius: radio.completo,
  },
  pie: { position: 'absolute', left: espacio.m, right: espacio.m },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    padding: espacio.xs,
    paddingRight: espacio.s,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  estampa: { width: 64, height: 64, borderRadius: radio.m },
  textos: { flex: 1, gap: 2 },
  pista: {
    alignSelf: 'center',
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderRadius: radio.completo,
  },
});
