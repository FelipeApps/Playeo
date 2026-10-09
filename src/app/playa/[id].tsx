import Feather from '@expo/vector-icons/Feather';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnilloPuntuacion } from '@/components/anillo-puntuacion';
import { BarraCristal } from '@/components/barra-cristal';
import { Boton } from '@/components/boton';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { FotoPlaya } from '@/components/foto-playa';
import { Icono } from '@/components/icono';
import { CIELO_ALTO } from '@/components/ilustracion-playa';
import { Medida } from '@/components/medida';
import { useBarraEstado } from '@/components/pantalla';
import { Presionable } from '@/components/presionable';
import { PrevisionHoras } from '@/components/prevision-horas';
import { Texto } from '@/components/texto';
import { buscarPlaya, type Caracteristicas } from '@/data/playas';
import { useCondiciones, usePlayaPuntuada } from '@/hooks/use-ranking';
import { usePreferencias } from '@/preferencias/contexto';
import { mejorFranja, olaEfectiva, puntuar } from '@/scoring/puntuacion';
import { useSesion } from '@/sesion/contexto';
import { espacio, fuentes, radio, sombra, useTema } from '@/theme';
import { etiquetaTipo, infoCaracteristica } from '@/utils/etiquetas';
import { decimal, puntoCardinal, resumen } from '@/utils/resumen';

const ALTO_FOTO = 340;
const CLAVES = Object.keys(infoCaracteristica) as (keyof Caracteristicas)[];

export default function PantallaPlaya() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colores, esOscuro } = useTema();
  const insets = useSafeAreaInsets();
  const { width: ancho } = useWindowDimensions();
  const playa = buscarPlaya(id);
  const puntuada = usePlayaPuntuada(id);
  const consulta = useCondiciones(playa?.region);
  const { preferencias } = usePreferencias();
  const { sesion } = useSesion();
  const desplazamiento = useSharedValue(0);
  useBarraEstado('clara');

  const alDesplazar = useAnimatedScrollHandler((evento) => {
    desplazamiento.set(evento.contentOffset.y);
  });

  const botonVolver = (
    <Presionable
      accessibilityLabel="Volver"
      onPress={() => router.back()}
      hitSlop={6}
      style={[estilos.volver, { top: insets.top + espacio.xs }]}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <Feather name="arrow-left" size={22} color="#FFFFFF" />
    </Presionable>
  );

  if (!playa) {
    return (
      <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
        <EstadoVacio
          escena="extravio"
          titulo="No encontramos esa playa"
          mensaje="Puede que el enlace esté anticuado. Vuelve a la lista para elegir otra.">
          <Boton titulo="Volver a la lista" onPress={() => router.back()} />
        </EstadoVacio>
      </View>
    );
  }

  const rasgos = playa.caracteristicas;
  const resguardada = rasgos?.resguardada ?? false;
  const presentes = rasgos ? CLAVES.filter((clave) => rasgos[clave]) : [];
  const lugar = [playa.municipio, playa.tipo ? etiquetaTipo[playa.tipo] : '']
    .filter(Boolean)
    .join('. ');
  const coordenada = { latitude: playa.lat, longitude: playa.lon };
  const marco = {
    backgroundColor: colores.superficie,
    borderColor: colores.borde,
  };
  const actual = puntuada?.condiciones.actual;
  const olaOrilla = actual ? olaEfectiva(actual.olaAltura, resguardada) : null;

  // Las 24 horas de hoy puntuadas. Las horas vienen como "2026-10-09T14:00", en la
  // hora local de la playa.
  const horaActual = actual ? Number(actual.hora.slice(11, 13)) : 0;
  const dia = (puntuada?.condiciones.horas ?? []).map((medicion) => ({
    hora: Number(medicion.hora.slice(11, 13)),
    total: puntuar(medicion, playa.caracteristicas, preferencias).total,
    viento: medicion.viento,
    ola: olaEfectiva(medicion.olaAltura, resguardada),
  }));
  // Primero la mejor franja de lo que queda de día; si ya no queda ninguna, la del día
  // entero, avisando de que ha pasado.
  const franjaPendiente = mejorFranja(dia.filter(({ hora }) => hora >= horaActual));
  const franja = franjaPendiente ?? mejorFranja(dia);
  // De aquí al final del día; de noche ya no queda nada útil que enseñar.
  const restoDelDia = dia
    .filter(({ hora }) => hora >= horaActual && hora >= 7 && hora <= 21)
    .map((hora) => ({ ...hora, destacada: hora.hora === horaActual }));

  return (
    <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <Animated.ScrollView
        onScroll={alDesplazar}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + espacio.xl }}>
        <View style={estilos.foto}>
          <FotoPlaya playa={playa} proporcion={ancho / ALTO_FOTO} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(4,20,30,0.5)', 'rgba(4,20,30,0)', 'rgba(4,20,30,0.85)']}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={estilos.sobreFoto}>
            <View style={estilos.titulo}>
              <Text style={estilos.nombre} accessibilityRole="header">
                {playa.nombre}
              </Text>
              {lugar ? (
                <Text style={estilos.lugar}>
                  {lugar}
                  {playa.zona ? `, zona ${playa.zona}` : ''}.
                </Text>
              ) : null}
            </View>
            {puntuada ? (
              <AnilloPuntuacion
                valor={puntuada.puntuacion.total}
                tamano={84}
                grosor={8}
                sobreFoto
              />
            ) : null}
          </View>
        </View>

        <View style={estilos.contenido}>
          <View style={estilos.bloque}>
            <Texto variante="titulo" accessibilityRole="header">
              Ahora mismo
            </Texto>
            {actual && puntuada ? (
              <>
                <Text style={[estilos.frase, { color: colores.texto }]}>
                  {resumen(actual, resguardada, puntuada.condiciones.esDeDia)}.
                </Text>
                <View style={[estilos.rejilla, sombra(esOscuro), marco]}>
                  <View style={estilos.filaMedidas}>
                    <Medida
                      disposicion="columna"
                      icono="viento"
                      valor={`${Math.round(actual.viento)} km/h`}
                      etiqueta={`Del ${puntoCardinal(actual.direccionViento)}`}
                    />
                    <Medida
                      disposicion="columna"
                      icono="ola"
                      valor={olaOrilla == null ? 'Sin dato' : `${decimal(olaOrilla)} m`}
                      etiqueta="Oleaje"
                    />
                    <Medida
                      disposicion="columna"
                      icono="agua"
                      valor={
                        actual.tempAgua == null ? 'Sin dato' : `${Math.round(actual.tempAgua)} °C`
                      }
                      etiqueta="Agua"
                    />
                  </View>
                  <View style={[estilos.separador, { backgroundColor: colores.borde }]} />
                  <View style={estilos.filaMedidas}>
                    <Medida
                      disposicion="columna"
                      icono="rumbo"
                      valor={`${Math.round(actual.rachas)} km/h`}
                      etiqueta="Rachas"
                    />
                    <Medida
                      disposicion="columna"
                      icono="uv"
                      valor={decimal(actual.uv, 0)}
                      etiqueta="Índice UV"
                    />
                    <Medida
                      disposicion="columna"
                      icono="calima"
                      valor={
                        actual.polvo == null ? 'Sin dato' : `${Math.round(actual.polvo)} µg/m³`
                      }
                      etiqueta="Polvo"
                    />
                  </View>
                </View>
              </>
            ) : consulta.isPending ? (
              <Esqueleto alto={172} redondeo={radio.l} />
            ) : (
              <Texto color="textoSecundario">
                No hemos podido consultar el estado de esta playa. Vuelve a Hoy y desliza hacia
                abajo para reintentarlo.
              </Texto>
            )}
          </View>

          {restoDelDia.length > 0 ? (
            <View style={estilos.bloque}>
              <Texto variante="titulo" accessibilityRole="header">
                Hoy por horas
              </Texto>
              {franja ? (
                <View style={[estilos.franja, { backgroundColor: colores.arena }]}>
                  <Texto variante="etiqueta" color="sobreArena">
                    {franjaPendiente
                      ? 'Mejor franja que queda hoy'
                      : 'La mejor franja de hoy ya ha pasado'}
                  </Texto>
                  <Texto variante="subtitulo" color="sobreArena">
                    De {franja.desde}:00 a {franja.hasta}:00, con {franja.media} puntos de media
                  </Texto>
                </View>
              ) : null}
              <PrevisionHoras horas={restoDelDia} />
            </View>
          ) : null}

          {sesion ? (
            <Boton
              titulo="Crear una quedada aquí"
              onPress={() =>
                router.push({
                  pathname: '/evento/nuevo',
                  params: { playa: playa.id },
                })
              }
            />
          ) : null}

          {playa.descripcion ? (
            <Texto style={estilos.descripcion}>{playa.descripcion}</Texto>
          ) : null}

          {rasgos ? (
            <View style={estilos.bloque}>
              <Texto variante="titulo" accessibilityRole="header">
                Qué tiene
              </Texto>
              <View style={estilos.mosaico}>
                {presentes.map((clave) => (
                  <View key={clave} style={[estilos.tesela, marco]}>
                    <View style={[estilos.medallon, { backgroundColor: colores.arena }]}>
                      <Icono
                        nombre={infoCaracteristica[clave].icono}
                        tamano={22}
                        color={colores.sobreArena}
                      />
                    </View>
                    <Texto variante="detalle" style={estilos.flexible}>
                      {infoCaracteristica[clave].etiqueta}
                    </Texto>
                  </View>
                ))}
              </View>
              {rasgos.socorrista ? null : (
                <Texto variante="detalle" color="textoSecundario">
                  Sin servicio de socorrismo: báñate solo si el mar está tranquilo.
                </Texto>
              )}
            </View>
          ) : (
            <Texto variante="detalle" color="textoSecundario">
              Aún no tenemos los servicios de esta playa (socorrista, accesos). La puntuación usa
              solo el tiempo y el estado del mar.
            </Texto>
          )}

          <View style={estilos.bloque}>
            <Texto variante="titulo" accessibilityRole="header">
              Dónde está
            </Texto>
            <View style={[estilos.mapa, { borderColor: colores.borde }]} pointerEvents="none">
              <MapView
                style={StyleSheet.absoluteFill}
                liteMode
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
                userInterfaceStyle={esOscuro ? 'dark' : 'light'}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                initialRegion={{
                  ...coordenada,
                  latitudeDelta: 0.035,
                  longitudeDelta: 0.035,
                }}>
                <Marker coordinate={coordenada} pinColor={colores.primario} />
              </MapView>
            </View>
            {playa.coordenadasVerificadas ? null : (
              <Texto variante="detalle" color="textoSecundario">
                Ubicación aproximada, pendiente de verificar.
              </Texto>
            )}
            <Boton
              titulo="Cómo llegar"
              accessibilityRole="link"
              accessibilityHint="Abre la ruta en la aplicación de mapas"
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${playa.lat},${playa.lon}`,
                )
              }>
              <Icono nombre="ubicacion" tamano={20} color={colores.sobrePrimario} />
            </Boton>
          </View>

          {playa.foto ? (
            <Texto
              variante="etiqueta"
              color="textoSecundario"
              accessibilityRole="link"
              onPress={() => playa.foto && Linking.openURL(playa.foto.pagina)}
              style={estilos.credito}>
              Foto: {playa.foto.autor}, {playa.foto.licencia}, vía Wikimedia Commons.
            </Texto>
          ) : null}
        </View>
      </Animated.ScrollView>

      <BarraCristal desplazamiento={desplazamiento} umbral={ALTO_FOTO - 90} tinte={CIELO_ALTO}>
        <View style={estilos.barra}>
          <Text style={estilos.tituloBarra} numberOfLines={1}>
            {playa.nombre}
          </Text>
        </View>
      </BarraCristal>
      {botonVolver}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  foto: { height: ALTO_FOTO, justifyContent: 'flex-end' },
  sobreFoto: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espacio.s,
    padding: espacio.m,
    paddingBottom: espacio.l,
  },
  titulo: { flex: 1, gap: espacio.xxs },
  nombre: {
    fontFamily: fuentes.titular,
    fontSize: 36,
    lineHeight: 39,
    letterSpacing: -0.8,
    color: '#FFFFFF',
  },
  lugar: {
    fontFamily: fuentes.textoMedio,
    fontSize: 15,
    lineHeight: 21,
    color: '#E3EEF3',
  },
  volver: {
    position: 'absolute',
    left: espacio.m,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,20,30,0.45)',
  },
  contenido: {
    paddingHorizontal: espacio.m,
    paddingTop: espacio.l,
    gap: espacio.xl,
  },
  bloque: { gap: espacio.s },
  franja: { padding: espacio.m, gap: 2, borderRadius: radio.l },
  frase: { fontFamily: fuentes.textoMedio, fontSize: 18, lineHeight: 26 },
  rejilla: {
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: espacio.m,
    paddingHorizontal: espacio.xs,
    gap: espacio.m,
  },
  filaMedidas: { flexDirection: 'row', gap: espacio.xs },
  separador: { height: StyleSheet.hairlineWidth, marginHorizontal: espacio.m },
  descripcion: { fontSize: 17, lineHeight: 27 },
  mosaico: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs },
  tesela: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    minHeight: 64,
    padding: espacio.s,
    borderRadius: radio.m,
    borderWidth: StyleSheet.hairlineWidth,
  },
  medallon: {
    width: 40,
    height: 40,
    borderRadius: radio.completo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexible: { flex: 1 },
  mapa: {
    height: 170,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  credito: { paddingVertical: espacio.s },
  barra: { height: 60, justifyContent: 'center', paddingLeft: 56 },
  tituloBarra: {
    fontFamily: fuentes.titulo,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
