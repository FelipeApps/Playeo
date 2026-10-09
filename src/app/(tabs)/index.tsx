import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvisoCalima } from '@/components/aviso-calima';
import { BarraCristal } from '@/components/barra-cristal';
import { Boton } from '@/components/boton';
import { RankingEsqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { ALTO_HORIZONTE, Horizonte } from '@/components/horizonte';
import { ALTO_PESTANAS, useBarraEstado } from '@/components/pantalla';
import { SelectorPlan } from '@/components/selector-plan';
import { TarjetaDestacada } from '@/components/tarjeta-destacada';
import { TarjetaRanking } from '@/components/tarjeta-ranking';
import { Texto } from '@/components/texto';
import { useRanking } from '@/hooks/use-ranking';
import { usePreferencias } from '@/preferencias/contexto';
import { useRegion } from '@/region/contexto';
import { nivelCalima } from '@/scoring/puntuacion';
import { useSesion } from '@/sesion/contexto';
import { useNotificaciones } from '@/social/notificaciones';
import { espacio, fuentes, useTema } from '@/theme';
import { cieloDe, horaDecimal } from '@/utils/luz';
import { etiquetaPlan, horaCorta } from '@/utils/resumen';

const SALIDA_SUAVE = Easing.bezier(0.23, 1, 0.32, 1);
/** Separación entre la entrada de una tarjeta y la siguiente, en ms. */
const ESCALON = 55;

export default function PantallaHoy() {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const { width: anchoPantalla } = useWindowDimensions();
  const { preferencias, cambiar } = usePreferencias();
  const { zona } = useRegion();
  const { sesion } = useSesion();
  const { data: notificaciones } = useNotificaciones();
  const avisosSinLeer = notificaciones?.filter((aviso) => !aviso.leida).length ?? 0;
  const { consulta, ranking, calima, polvo, nubosidad } = useRanking();
  const [arranque] = useState(() => Date.now());
  const [refrescando, setRefrescando] = useState(false);
  const desplazamiento = useSharedValue(0);
  useBarraEstado('clara');

  const alDesplazar = useAnimatedScrollHandler((evento) => {
    desplazamiento.set(evento.contentOffset.y);
  });

  // El cielo corresponde al momento de los datos; antes de tenerlos, al de abrir la app.
  const ahora = new Date(consulta.dataUpdatedAt || arranque);
  const calimaHoy = nivelCalima(calima);
  const cielo = cieloDe(horaDecimal(ahora), nubosidad, calimaHoy);
  const anchoTarjeta = anchoPantalla - espacio.m * 2;

  const refrescar = async () => {
    setRefrescando(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { isError } = await consulta.refetch();
    Haptics.notificationAsync(
      isError ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success,
    );
    setRefrescando(false);
  };

  const [mejor, ...resto] = ranking;

  let contenido;
  if (mejor) {
    contenido = (
      <>
        {consulta.isError ? (
          <View style={[estilos.nota, { backgroundColor: colores.arena }]}>
            <Texto variante="detalle" color="sobreArena">
              No se pudo actualizar. Ves los datos de las {horaCorta(consulta.dataUpdatedAt)}.
            </Texto>
          </View>
        ) : null}

        {calimaHoy === 'ninguna' ? null : (
          <AvisoCalima nivel={calimaHoy} polvo={polvo} sensible={preferencias.sensibleCalima} />
        )}

        <Animated.View
          key={mejor.playa.id}
          entering={FadeInDown.duration(420).easing(SALIDA_SUAVE)}
          layout={LinearTransition.duration(300).easing(SALIDA_SUAVE)}>
          <TarjetaDestacada entrada={mejor} ancho={anchoTarjeta} />
        </Animated.View>

        <View style={estilos.encabezado}>
          <Texto variante="titulo" accessibilityRole="header">
            El resto de la zona
          </Texto>
          <Texto variante="detalle" color="textoSecundario">
            {resto.length} playas
          </Texto>
        </View>

        {resto.map((entrada, indice) => {
          const retardo = Math.min(indice + 1, 7) * ESCALON;
          return (
            <Animated.View
              key={entrada.playa.id}
              entering={FadeInDown.delay(retardo).duration(400).easing(SALIDA_SUAVE)}
              layout={LinearTransition.duration(300).easing(SALIDA_SUAVE)}>
              <TarjetaRanking
                entrada={entrada}
                puesto={indice + 2}
                ancho={anchoTarjeta}
                retardo={retardo}
              />
            </Animated.View>
          );
        })}

        <Texto variante="etiqueta" color="textoSecundario" style={estilos.pie}>
          Datos de Open-Meteo, actualizados a las {horaCorta(consulta.dataUpdatedAt)}. La
          puntuación es orientativa: comprueba siempre las banderas de la playa.
        </Texto>
      </>
    );
  } else if (consulta.isPending) {
    contenido = <RankingEsqueleto />;
  } else if (consulta.isError) {
    contenido = (
      <EstadoVacio
        escena="sin-conexion"
        titulo="No llegan los datos del mar"
        mensaje="No hemos podido consultar el estado de las playas. Revisa tu conexión y vuelve a intentarlo.">
        <Boton titulo="Reintentar" onPress={refrescar} />
      </EstadoVacio>
    );
  } else {
    contenido = (
      <EstadoVacio
        escena="vacio"
        titulo="Hoy no hay playas que mostrar"
        mensaje="Open-Meteo no ha devuelto datos para ninguna playa. Desliza hacia abajo para volver a consultar."
      />
    );
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <Animated.ScrollView
        onScroll={alDesplazar}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
            tintColor="#FFFFFF"
            colors={[colores.primario]}
            progressBackgroundColor={colores.superficie}
            progressViewOffset={insets.top}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + ALTO_PESTANAS + espacio.l }}>
        <Horizonte
          desplazamiento={desplazamiento}
          cielo={cielo}
          ahora={ahora}
          zona={zona?.nombre ?? ''}
          alCambiarZona={() => router.push('/zona')}
          avisos={avisosSinLeer}
          alAbrirAvisos={sesion ? () => router.push('/notificaciones') : undefined}
        />
        <SelectorPlan plan={preferencias.plan} alCambiar={(plan) => cambiar({ plan })} />
        <View style={estilos.lista}>{contenido}</View>
      </Animated.ScrollView>

      <BarraCristal desplazamiento={desplazamiento} umbral={ALTO_HORIZONTE - 30} tinte={cielo.colores[0]}>
        <View style={estilos.barra}>
          <View style={estilos.marca}>
            <View style={[estilos.punto, { backgroundColor: colores.solFijo }]} />
            <Text style={estilos.nombreMarca}>Playeo</Text>
          </View>
          <Text style={estilos.planBarra} numberOfLines={1}>
            {zona?.nombre}, {etiquetaPlan[preferencias.plan].toLowerCase()}
          </Text>
        </View>
      </BarraCristal>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  lista: { paddingHorizontal: espacio.m, paddingTop: espacio.xs, gap: espacio.s },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: espacio.s,
    paddingHorizontal: espacio.xxs,
    paddingTop: espacio.m,
  },
  nota: { padding: espacio.s, borderRadius: 14 },
  pie: { textAlign: 'center', paddingHorizontal: espacio.l, paddingTop: espacio.m },
  barra: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  punto: { width: 10, height: 10, borderRadius: 5 },
  nombreMarca: { fontFamily: fuentes.titulo, fontSize: 17, color: '#FFFFFF', letterSpacing: -0.2 },
  planBarra: { fontFamily: fuentes.textoMedio, fontSize: 14, color: '#E3EEF3' },
});
