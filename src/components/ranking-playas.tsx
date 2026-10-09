import * as Haptics from 'expo-haptics';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { AvisoCalima } from '@/components/aviso-calima';
import { Boton } from '@/components/boton';
import { RankingEsqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { SelectorPlan } from '@/components/selector-plan';
import { TarjetaDestacada } from '@/components/tarjeta-destacada';
import { TarjetaRanking } from '@/components/tarjeta-ranking';
import { Texto } from '@/components/texto';
import { useRanking } from '@/hooks/use-ranking';
import { usePreferencias } from '@/preferencias/contexto';
import { nivelCalima } from '@/scoring/puntuacion';
import { espacio, useTema } from '@/theme';
import { horaCorta } from '@/utils/resumen';

const SALIDA_SUAVE = Easing.bezier(0.23, 1, 0.32, 1);
/** Separación entre la entrada de una tarjeta y la siguiente, en ms. */
const ESCALON = 55;

/**
 * Ranking de playas de la zona para hoy: selector de plan, la mejor destacada y el resto.
 * Es el contenido de Explorar cuando la actividad es Playa.
 */
export function RankingPlayas() {
  const { colores } = useTema();
  const { width: anchoPantalla } = useWindowDimensions();
  const { preferencias, cambiar } = usePreferencias();
  const { consulta, ranking, calima, polvo } = useRanking();
  const calimaHoy = nivelCalima(calima);
  const anchoTarjeta = anchoPantalla - espacio.m * 2;
  const [mejor, ...resto] = ranking;

  const refrescar = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { isError } = await consulta.refetch();
    Haptics.notificationAsync(
      isError ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success,
    );
  };

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
          Datos de Open-Meteo, actualizados a las {horaCorta(consulta.dataUpdatedAt)}. La puntuación
          es orientativa: comprueba siempre las banderas de la playa.
        </Texto>
        <Boton
          titulo="Actualizar ahora"
          variante="secundario"
          cargando={consulta.isRefetching}
          onPress={refrescar}
        />
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
        mensaje="Open-Meteo no ha devuelto datos para ninguna playa. Vuelve a intentarlo en un rato."
      />
    );
  }

  return (
    <>
      <View style={estilos.selector}>
        <SelectorPlan plan={preferencias.plan} alCambiar={(plan) => cambiar({ plan })} />
      </View>
      <View style={estilos.lista}>{contenido}</View>
    </>
  );
}

const estilos = StyleSheet.create({
  // El selector se desliza de borde a borde, por fuera del margen de la lista.
  selector: { marginHorizontal: -espacio.m },
  lista: { gap: espacio.s },
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
});
