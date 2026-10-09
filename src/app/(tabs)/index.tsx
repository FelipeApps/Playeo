import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarraCristal } from '@/components/barra-cristal';
import { Boton } from '@/components/boton';
import { Esqueleto } from '@/components/esqueleto';
import { ALTO_HORIZONTE, Horizonte } from '@/components/horizonte';
import { Icono } from '@/components/icono';
import { ALTO_PESTANAS, useBarraEstado } from '@/components/pantalla';
import { Presionable } from '@/components/presionable';
import { IndicadorSol, useRefrescoSol } from '@/components/refresco-sol';
import { TarjetaDestacada } from '@/components/tarjeta-destacada';
import { TarjetaEvento, type EventoResumido } from '@/components/tarjeta-evento';
import { Texto } from '@/components/texto';
import { ACTIVIDADES, type Actividad } from '@/data/actividades';
import { useRanking } from '@/hooks/use-ranking';
import { supabaseConfigurado } from '@/lib/supabase';
import { useRegion } from '@/region/contexto';
import { nivelCalima } from '@/scoring/puntuacion';
import { useMiPerfil, useSesion } from '@/sesion/contexto';
import { useEventos } from '@/social/eventos';
import { useNotificaciones } from '@/social/notificaciones';
import { espacio, fuentes, radio, sombra, useTema } from '@/theme';
import { cieloDe, horaDecimal } from '@/utils/luz';

/** Quedadas que se enseñan de cada tipo en Inicio; el resto está en la pestaña Quedadas. */
const MAXIMO_POR_BLOQUE = 3;

function Bloque({
  titulo,
  eventos,
  total,
}: {
  titulo: string;
  eventos: EventoResumido[];
  /** Si hay más de las que se enseñan, se ofrece verlas todas. */
  total: number;
}) {
  if (eventos.length === 0) return null;
  return (
    <View style={estilos.bloque}>
      <Texto variante="titulo" accessibilityRole="header">
        {titulo}
      </Texto>
      {eventos.map((evento) => (
        <TarjetaEvento key={evento.id} evento={evento} />
      ))}
      {total > eventos.length ? (
        <Boton
          titulo={`Ver las ${total}`}
          variante="secundario"
          onPress={() => router.navigate('/quedadas')}
        />
      ) : null}
    </View>
  );
}

/** Rejilla de actividades: las de catálogo llevan a Explorar; las demás, a crear una quedada. */
function Actividades({ conSesion }: { conSesion: boolean }) {
  const { colores, esOscuro } = useTema();

  const abrir = (actividad: Actividad) => {
    Haptics.selectionAsync();
    if (actividad.tipoSitio !== 'manual') {
      router.navigate({ pathname: '/explorar', params: { actividad: actividad.id } });
    } else if (conSesion) {
      router.push({ pathname: '/evento/nuevo', params: { actividad: actividad.id } });
    } else {
      router.push('/cuenta/entrar');
    }
  };

  return (
    <View style={estilos.bloque}>
      <Texto variante="titulo" accessibilityRole="header">
        ¿Qué te apetece?
      </Texto>
      <View style={estilos.rejilla}>
        {ACTIVIDADES.map((actividad) => (
          <View key={actividad.id} style={estilos.celda}>
            <Presionable
              accessibilityLabel={actividad.nombre}
              accessibilityHint={
                actividad.tipoSitio === 'manual'
                  ? 'Crea una quedada de esta actividad'
                  : `Muestra ${actividad.lugares} de tu zona`
              }
              onPress={() => abrir(actividad)}
              style={[
                estilos.tesela,
                sombra(esOscuro),
                { backgroundColor: colores.superficie, borderColor: colores.borde },
              ]}>
              <View style={[estilos.medallon, { backgroundColor: colores.arena }]}>
                <Icono nombre={actividad.icono} tamano={24} color={colores.sobreArena} />
              </View>
              {/* "Senderismo" y "Baloncesto" no caben a tamaño normal en un cuarto de pantalla. */}
              <Texto
                variante="etiqueta"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}>
                {actividad.nombre}
              </Texto>
            </Presionable>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function PantallaInicio() {
  const { colores, esOscuro } = useTema();
  const insets = useSafeAreaInsets();
  const { width: anchoPantalla } = useWindowDimensions();
  const { zona } = useRegion();
  const { sesion, lista: sesionLista } = useSesion();
  const { data: perfil } = useMiPerfil();
  const { data: notificaciones } = useNotificaciones();
  const eventos = useEventos(zona?.id);
  const { consulta, ranking, calima, nubosidad } = useRanking();
  const [arranque] = useState(() => Date.now());
  const desplazamiento = useSharedValue(0);
  useBarraEstado('clara');

  const alDesplazar = useAnimatedScrollHandler((evento) => {
    desplazamiento.set(evento.contentOffset.y);
  });

  // El cielo corresponde al momento de los datos; antes de tenerlos, al de abrir la app.
  const ahora = new Date(consulta.dataUpdatedAt || arranque);
  const cielo = cieloDe(horaDecimal(ahora), nubosidad, nivelCalima(calima));
  const avisosSinLeer = notificaciones?.filter((aviso) => !aviso.leida).length ?? 0;
  const nombre = perfil?.nombre_visible.split(' ')[0];

  const refrescar = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const [tiempo] = await Promise.all([consulta.refetch(), sesion ? eventos.refetch() : null]);
    Haptics.notificationAsync(
      tiempo.isError
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Success,
    );
  };
  const refresco = useRefrescoSol(desplazamiento, refrescar);

  const todas: EventoResumido[] = eventos.data ?? [];
  const invitaciones = todas.filter((e) => e.me_han_invitado);
  const mias = todas.filter(
    (e) => !e.me_han_invitado && (e.mi_respuesta === 'voy' || e.mi_respuesta === 'quiza'),
  );
  const deLaZona = todas.filter((e) => !invitaciones.includes(e) && !mias.includes(e));
  const mejorPlaya = ranking[0];
  const marco = { backgroundColor: colores.superficie, borderColor: colores.borde };

  return (
    <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <IndicadorSol tiron={refresco.tiron} fase={refresco.fase} cielo={cielo.colores[0]} />
      {/* Sin rebote nativo: el tirón desde arriba lo lleva el gesto propio, igual en iOS y Android. */}
      <GestureDetector gesture={refresco.gesto}>
        <Animated.ScrollView
          onScroll={alDesplazar}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          style={[{ backgroundColor: colores.fondo }, refresco.estiloContenido]}
          contentContainerStyle={{ paddingBottom: insets.bottom + ALTO_PESTANAS + espacio.l }}>
          <Horizonte
            desplazamiento={desplazamiento}
            cielo={cielo}
            ahora={ahora}
            pregunta={nombre ? `¿Qué plan hay, ${nombre}?` : '¿Qué plan hay hoy?'}
            zona={zona?.nombre ?? ''}
            alCambiarZona={() => router.push('/zona')}
            avisos={avisosSinLeer}
            alAbrirAvisos={sesion ? () => router.push('/notificaciones') : undefined}
          />

          <View style={estilos.contenido}>
            {!sesionLista ? (
              <Esqueleto alto={134} redondeo={radio.l} />
            ) : sesion ? (
              <>
                <Bloque
                  titulo="Te han invitado"
                  eventos={invitaciones.slice(0, MAXIMO_POR_BLOQUE)}
                  total={invitaciones.length}
                />
                {eventos.isPending ? (
                  <Esqueleto alto={134} redondeo={radio.l} />
                ) : mias.length > 0 ? (
                  <Bloque
                    titulo="Tus próximas quedadas"
                    eventos={mias.slice(0, MAXIMO_POR_BLOQUE)}
                    total={mias.length}
                  />
                ) : (
                  <View style={[estilos.invitacion, sombra(esOscuro), marco]}>
                    <Texto variante="titulo">
                      {eventos.isError ? 'No llegan tus quedadas' : 'No tienes nada planeado'}
                    </Texto>
                    <Texto color="textoSecundario">
                      {eventos.isError
                        ? 'Comprueba la conexión con el servidor y tira hacia abajo para reintentar.'
                        : 'Monta un plan y avisa a tu gente: playa, monte, una pachanga o lo que se te ocurra.'}
                    </Texto>
                  </View>
                )}
                <Boton titulo="Crear una quedada" onPress={() => router.push('/evento/nuevo')} />
                <Bloque
                  titulo={zona ? `Planes en ${zona.nombre}` : 'Planes cerca'}
                  eventos={deLaZona.slice(0, MAXIMO_POR_BLOQUE)}
                  total={deLaZona.length}
                />
              </>
            ) : (
              <View style={[estilos.invitacion, sombra(esOscuro), marco]}>
                <Texto variante="titulo">Queda con tu gente</Texto>
                <Texto color="textoSecundario">
                  {supabaseConfigurado
                    ? 'Con una cuenta podrás crear quedadas de playa, monte o deporte, apuntarte a las de tus amigos y chatear con ellos.'
                    : 'Las funciones sociales no están configuradas en esta instalación. Explorar funciona igual.'}
                </Texto>
                {supabaseConfigurado ? (
                  <>
                    <Boton titulo="Crear cuenta" onPress={() => router.push('/cuenta/registro')} />
                    <Boton
                      titulo="Ya tengo cuenta"
                      variante="secundario"
                      onPress={() => router.push('/cuenta/entrar')}
                    />
                  </>
                ) : null}
              </View>
            )}

            <Actividades conSesion={sesion != null} />

            {mejorPlaya ? (
              <View style={estilos.bloque}>
                <Texto variante="titulo" accessibilityRole="header">
                  La playa del día
                </Texto>
                <TarjetaDestacada entrada={mejorPlaya} ancho={anchoPantalla - espacio.m * 2} />
                <Boton
                  titulo="Ver el ranking de playas"
                  variante="secundario"
                  onPress={() =>
                    router.navigate({ pathname: '/explorar', params: { actividad: 'playa' } })
                  }
                />
              </View>
            ) : null}
          </View>
        </Animated.ScrollView>
      </GestureDetector>

      <BarraCristal
        desplazamiento={desplazamiento}
        umbral={ALTO_HORIZONTE - 30}
        tinte={cielo.colores[0]}>
        <View style={estilos.barra}>
          <View style={estilos.marca}>
            <View style={[estilos.punto, { backgroundColor: colores.solFijo }]} />
            <Text style={estilos.nombreMarca}>Planeo</Text>
          </View>
          <Text style={estilos.zonaBarra} numberOfLines={1}>
            {zona?.nombre}
          </Text>
        </View>
      </BarraCristal>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { paddingHorizontal: espacio.m, paddingTop: espacio.s, gap: espacio.l },
  bloque: { gap: espacio.s },
  invitacion: {
    padding: espacio.l,
    gap: espacio.s,
    borderRadius: radio.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -espacio.xxs },
  celda: { width: '25%', padding: espacio.xxs },
  tesela: {
    alignItems: 'center',
    gap: espacio.xs,
    paddingVertical: espacio.s,
    paddingHorizontal: espacio.xxs,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  medallon: {
    width: 48,
    height: 48,
    borderRadius: radio.completo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barra: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  punto: { width: 10, height: 10, borderRadius: 5 },
  nombreMarca: { fontFamily: fuentes.titulo, fontSize: 17, color: '#FFFFFF', letterSpacing: -0.2 },
  zonaBarra: { fontFamily: fuentes.textoMedio, fontSize: 14, color: '#E3EEF3' },
});
