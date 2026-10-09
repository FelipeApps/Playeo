import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Animated, { Easing, FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { AnilloPuntuacion } from '@/components/anillo-puntuacion';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { nivelPuntuacion } from '@/scoring/puntuacion';
import { espacio, radio, sombra, useTema } from '@/theme';

const SALIDA_SUAVE = Easing.bezier(0.23, 1, 0.32, 1);

export interface PuntoMapa {
  id: string;
  nombre: string;
  descripcion: string;
  lat: number;
  lon: number;
  /** Puntuación del día, si el lugar la tiene: da color al marcador. */
  total?: number;
}

interface Props {
  puntos: PuntoMapa[];
  /** Cambia al cambiar de zona o de actividad: el mapa se vuelve a encuadrar. */
  clave: string;
  alAbrir: (id: string) => void;
}

/** Encuadre que contiene todos los puntos, con algo de margen. */
function encuadrar(puntos: PuntoMapa[]) {
  const lats = puntos.map((punto) => punto.lat);
  const lons = puntos.map((punto) => punto.lon);
  const [latMin, latMax] = [Math.min(...lats), Math.max(...lats)];
  const [lonMin, lonMax] = [Math.min(...lons), Math.max(...lons)];
  return {
    latitude: (latMin + latMax) / 2,
    longitude: (lonMin + lonMax) / 2,
    latitudeDelta: Math.max((latMax - latMin) * 1.35, 0.08),
    longitudeDelta: Math.max((lonMax - lonMin) * 1.35, 0.08),
  };
}

/** Mapa de los lugares de una actividad. Al tocar un marcador sale su tarjeta. */
export function MapaLugares({ puntos, clave, alAbrir }: Props) {
  const { colores, esOscuro } = useTema();
  const [idSeleccionado, setIdSeleccionado] = useState<string | null>(null);
  const seleccionado = puntos.find((punto) => punto.id === idSeleccionado);

  if (puntos.length === 0) return null;

  return (
    <View style={[estilos.contenedor, { borderColor: colores.borde }]}>
      <MapView
        key={clave}
        style={StyleSheet.absoluteFill}
        initialRegion={encuadrar(puntos)}
        userInterfaceStyle={esOscuro ? 'dark' : 'light'}
        toolbarEnabled={false}
        showsCompass={false}
        onPress={(evento) => {
          if (evento.nativeEvent.action !== 'marker-press') setIdSeleccionado(null);
        }}>
        {puntos.map((punto) => {
          const activo = punto.id === idSeleccionado;
          // Color según la puntuación; azul neutro si el lugar no tiene.
          const color =
            punto.total == null ? colores.primario : colores[nivelPuntuacion(punto.total)];
          return (
            <Marker
              key={punto.id}
              coordinate={{ latitude: punto.lat, longitude: punto.lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={activo ? 2 : 1}
              accessibilityLabel={`${punto.nombre}${punto.total == null ? '' : `, puntuación ${punto.total} de 100`}`}
              onPress={() => {
                Haptics.selectionAsync();
                setIdSeleccionado(punto.id);
              }}>
              {/* El área táctil es mayor que el punto visible. */}
              <View style={estilos.zonaTactil}>
                <View
                  style={[
                    estilos.punto,
                    { backgroundColor: color, borderColor: colores.superficie },
                    activo && estilos.puntoActivo,
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View pointerEvents="box-none" style={estilos.pie}>
        {seleccionado ? (
          <Animated.View
            key={seleccionado.id}
            entering={FadeInDown.duration(260).easing(SALIDA_SUAVE)}
            exiting={FadeOutDown.duration(160)}>
            <Presionable
              accessibilityLabel={`${seleccionado.nombre}. ${seleccionado.descripcion}`}
              accessibilityHint="Abre su ficha"
              onPress={() => alAbrir(seleccionado.id)}
              style={[
                estilos.tarjeta,
                sombra(esOscuro),
                { backgroundColor: colores.superficie, borderColor: colores.borde },
              ]}>
              <View style={estilos.textos}>
                <Texto variante="subtitulo" numberOfLines={1}>
                  {seleccionado.nombre}
                </Texto>
                <Texto variante="detalle" color="textoSecundario" numberOfLines={1}>
                  {seleccionado.descripcion || 'Toca para ver la ficha'}
                </Texto>
              </View>
              {seleccionado.total == null ? null : (
                <AnilloPuntuacion valor={seleccionado.total} tamano={52} grosor={5} />
              )}
            </Presionable>
          </Animated.View>
        ) : (
          <View style={[estilos.pista, sombra(esOscuro), { backgroundColor: colores.superficie }]}>
            <Texto variante="detalle" color="textoSecundario">
              Toca un punto para ver el lugar
            </Texto>
          </View>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    height: 480,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  zonaTactil: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  punto: { width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  puntoActivo: { width: 28, height: 28, borderRadius: 14, borderWidth: 4 },
  pie: { position: 'absolute', left: espacio.s, right: espacio.s, bottom: espacio.s },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    padding: espacio.s,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  textos: { flex: 1, gap: 2 },
  pista: {
    alignSelf: 'center',
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderRadius: radio.completo,
  },
});
