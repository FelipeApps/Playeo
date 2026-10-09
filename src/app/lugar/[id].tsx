import { router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { AnilloPuntuacion } from '@/components/anillo-puntuacion';
import { Boton } from '@/components/boton';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { Icono } from '@/components/icono';
import { IlustracionActividad } from '@/components/ilustracion-actividad';
import { Medida } from '@/components/medida';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { PrevisionHoras } from '@/components/prevision-horas';
import { TarjetaEvento } from '@/components/tarjeta-evento';
import { Texto } from '@/components/texto';
import { buscarActividad } from '@/data/actividades';
import { usePreferencias } from '@/preferencias/contexto';
import { useRegion } from '@/region/contexto';
import { mejorFranja, puntuarSenderismo } from '@/scoring/puntuacion';
import { useSesion } from '@/sesion/contexto';
import { useEventos } from '@/social/eventos';
import { descripcionDe, useLugar, useRutasPuntuadas, type Lugar } from '@/social/lugares';
import { espacio, fuentes, radio, sombra, useTema } from '@/theme';
import { resumenMonte } from '@/utils/resumen';

/** Estado de hoy de una ruta: puntuación, datos del monte y previsión por horas. */
function EstadoRuta({ ruta }: { ruta: Lugar }) {
  const { colores, esOscuro } = useTema();
  const { preferencias } = usePreferencias();
  const { consulta, puntuadas } = useRutasPuntuadas([ruta]);
  const estado = puntuadas[0];
  const marco = { backgroundColor: colores.superficie, borderColor: colores.borde };

  if (consulta.isPending) return <Esqueleto alto={220} redondeo={radio.l} />;
  if (!estado) {
    return (
      <Texto color="textoSecundario">
        No llega la previsión de esta ruta. Vuelve a intentarlo en un rato.
      </Texto>
    );
  }

  const { actual } = estado;
  const horaActual = Number(actual.hora.slice(11, 13));
  const dia = estado.horas.map((medicion) => ({
    hora: Number(medicion.hora.slice(11, 13)),
    total: puntuarSenderismo(medicion, preferencias).total,
    viento: medicion.viento,
    lluvia: medicion.probLluvia,
  }));
  const franjaPendiente = mejorFranja(dia.filter(({ hora }) => hora >= horaActual));
  const franja = franjaPendiente ?? mejorFranja(dia);
  const restoDelDia = dia
    .filter(({ hora }) => hora >= horaActual && hora >= 7 && hora <= 21)
    .map((hora) => ({ ...hora, destacada: hora.hora === horaActual }));

  return (
    <>
      <View style={[estilos.tarjeta, estilos.enFila, sombra(esOscuro), marco]}>
        <AnilloPuntuacion valor={estado.total} tamano={72} grosor={7} />
        <Text style={[estilos.frase, { color: colores.texto }]}>{resumenMonte(actual)}.</Text>
      </View>

      <View style={[estilos.tarjeta, sombra(esOscuro), marco]}>
        <View style={estilos.filaMedidas}>
          <Medida
            disposicion="columna"
            icono="viento"
            valor={`${Math.round(actual.viento)} km/h`}
            etiqueta={`Rachas de ${Math.round(actual.rachas)}`}
          />
          <Medida
            disposicion="columna"
            icono="lluvia"
            valor={`${Math.round(actual.probLluvia)} %`}
            etiqueta="Prob. de lluvia"
          />
          <Medida
            disposicion="columna"
            icono="temperatura"
            valor={`${Math.round(actual.sensacion)} °C`}
            etiqueta="Sensación"
          />
        </View>
        <View style={[estilos.separador, { backgroundColor: colores.borde }]} />
        <View style={estilos.filaMedidas}>
          <Medida
            disposicion="columna"
            icono="senderismo"
            valor={`${Math.round(actual.nubesBajas)} %`}
            etiqueta="Nubes bajas"
          />
          <Medida
            disposicion="columna"
            icono="uv"
            valor={String(Math.round(actual.uv))}
            etiqueta="Índice UV"
          />
          <Medida
            disposicion="columna"
            icono="calima"
            valor={actual.polvo == null ? 'Sin dato' : `${Math.round(actual.polvo)} µg/m³`}
            etiqueta="Polvo"
          />
        </View>
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
      <Texto variante="etiqueta" color="textoSecundario">
        Previsión de Open-Meteo para un punto de la ruta, puntuada según tus preferencias. En el
        monte el tiempo cambia rápido y varía con la altura.
      </Texto>
    </>
  );
}

/** Ficha de una ruta o de una cancha del catálogo. */
export default function PantallaLugar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colores, esOscuro } = useTema();
  const { sesion } = useSesion();
  const { zona } = useRegion();
  const { data: lugar, isPending, isError } = useLugar(id);
  const eventos = useEventos(zona?.id);

  if (isPending) {
    return (
      <PantallaFormulario titulo="Lugar">
        <Esqueleto alto={240} redondeo={radio.l} />
      </PantallaFormulario>
    );
  }
  if (isError || !lugar) {
    return (
      <PantallaFormulario titulo="Lugar">
        <EstadoVacio
          escena="extravio"
          titulo="No encontramos este lugar"
          mensaje="Puede que ya no esté en el catálogo o que no haya conexión con el servidor.">
          <Boton titulo="Volver" onPress={() => router.back()} />
        </EstadoVacio>
      </PantallaFormulario>
    );
  }

  const actividad = buscarActividad(lugar.actividad_id);
  const conPunto = lugar.lat != null && lugar.lon != null;
  const coordenada = { latitude: lugar.lat ?? 0, longitude: lugar.lon ?? 0 };
  const aqui = eventos.data?.filter((evento) => evento.lugar_id === lugar.id) ?? [];

  return (
    <PantallaFormulario titulo={lugar.nombre} subtitulo={descripcionDe(lugar) || actividad.nombre}>
      <View style={estilos.banda}>
        <IlustracionActividad actividad={actividad.id} proporcion={2.4} />
      </View>
      <View style={[estilos.sello, { backgroundColor: colores.arena }]}>
        <Icono nombre={actividad.icono} tamano={18} color={colores.sobreArena} />
        <Texto variante="etiqueta" color="sobreArena">
          {actividad.nombre}
        </Texto>
      </View>

      {lugar.tipo === 'ruta' && conPunto ? <EstadoRuta ruta={lugar} /> : null}
      {lugar.tipo === 'cancha' ? (
        <Texto color="textoSecundario">
          Aquí ves dónde está. Planeo no sabe si está libre ni gestiona reservas: confírmalo antes
          de quedar.
        </Texto>
      ) : null}

      {sesion ? (
        <Boton
          titulo="Crear una quedada aquí"
          onPress={() =>
            router.push({
              pathname: '/evento/nuevo',
              params: { actividad: actividad.id, lugar: lugar.id },
            })
          }
        />
      ) : null}

      {aqui.length > 0 ? (
        <View style={estilos.bloque}>
          <Texto variante="titulo" accessibilityRole="header">
            Quedadas aquí
          </Texto>
          {aqui.map((evento) => (
            <TarjetaEvento key={evento.id} evento={evento} />
          ))}
        </View>
      ) : null}

      {conPunto ? (
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
              initialRegion={{ ...coordenada, latitudeDelta: 0.03, longitudeDelta: 0.03 }}>
              <Marker coordinate={coordenada} pinColor={colores.primario} />
            </MapView>
          </View>
          {lugar.tipo === 'ruta' ? (
            <Texto variante="detalle" color="textoSecundario">
              El punto marca la zona de la ruta, no su inicio exacto.
            </Texto>
          ) : null}
          <Boton
            titulo="Cómo llegar"
            variante="secundario"
            accessibilityRole="link"
            accessibilityHint="Abre la ruta en la aplicación de mapas"
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps/dir/?api=1&destination=${lugar.lat},${lugar.lon}`,
              )
            }>
            <Icono nombre="ubicacion" tamano={20} color={colores.primario} />
          </Boton>
        </View>
      ) : null}

      <Texto variante="etiqueta" color="textoSecundario">
        Datos del lugar: © colaboradores de OpenStreetMap.
      </Texto>
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  banda: { height: 140, borderRadius: radio.l, overflow: 'hidden' },
  sello: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: espacio.xs,
    paddingHorizontal: espacio.s,
    paddingVertical: 6,
    borderRadius: radio.completo,
  },
  tarjeta: {
    padding: espacio.m,
    gap: espacio.m,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  enFila: { flexDirection: 'row', alignItems: 'center' },
  frase: { flex: 1, fontFamily: fuentes.textoMedio, fontSize: 17, lineHeight: 24 },
  filaMedidas: { flexDirection: 'row', gap: espacio.xs },
  separador: { height: StyleSheet.hairlineWidth, marginHorizontal: espacio.m },
  bloque: { gap: espacio.s },
  franja: { padding: espacio.m, gap: 2, borderRadius: radio.l },
  mapa: {
    height: 170,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
