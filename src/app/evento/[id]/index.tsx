import Feather from '@expo/vector-icons/Feather';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnilloPuntuacion } from '@/components/anillo-puntuacion';
import { Boton } from '@/components/boton';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { FilaUsuario } from '@/components/fila-usuario';
import { FotoPlaya } from '@/components/foto-playa';
import { CIELO_ALTO } from '@/components/ilustracion-playa';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { useBarraEstado } from '@/components/pantalla';
import { Presionable } from '@/components/presionable';
import { PrevisionHoras } from '@/components/prevision-horas';
import { Segmentado } from '@/components/segmentado';
import { Texto } from '@/components/texto';
import { buscarPlaya } from '@/data/playas';
import { mensajeDeError } from '@/lib/supabase';
import { useSesion } from '@/sesion/contexto';
import {
  cuando,
  etiquetaRespuesta,
  etiquetaVisibilidad,
  useAccionesEvento,
  useAsistentes,
  useEvento,
  usePrevisionEvento,
  type Respuesta,
} from '@/social/eventos';
import { espacio, fuentes, radio, sombra, useTema } from '@/theme';
import { resumen } from '@/utils/resumen';

const ALTO_FOTO = 300;
const RESPUESTAS: { valor: Respuesta; etiqueta: string }[] = [
  { valor: 'voy', etiqueta: etiquetaRespuesta.voy },
  { valor: 'quiza', etiqueta: etiquetaRespuesta.quiza },
  { valor: 'no_voy', etiqueta: etiquetaRespuesta.no_voy },
];

/** Open-Meteo da previsión del tiempo con unos 16 días de antelación. */
const DIAS_DE_PREVISION = 15;

export default function PantallaEvento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colores, esOscuro } = useTema();
  const insets = useSafeAreaInsets();
  const { sesion } = useSesion();
  const { data: evento, isPending, isError } = useEvento(id);
  const asistentes = useAsistentes(id);
  const prevision = usePrevisionEvento(evento?.playa_id, evento?.empieza);
  const { responder, eliminar } = useAccionesEvento();
  useBarraEstado('clara');

  if (isPending) {
    return (
      <PantallaFormulario titulo="Quedada">
        <Esqueleto alto={260} redondeo={radio.xl} />
      </PantallaFormulario>
    );
  }

  // Sin datos: no existe o no tengo permiso para verla. A propósito, no se distingue.
  if (isError || !evento) {
    return (
      <PantallaFormulario titulo="Quedada">
        <EstadoVacio
          escena="extravio"
          titulo="No encontramos esta quedada"
          mensaje="Puede que se haya cancelado o que no esté abierta para ti.">
          <Boton titulo="Volver" onPress={() => router.back()} />
        </EstadoVacio>
      </PantallaFormulario>
    );
  }

  const playa = buscarPlaya(evento.playa_id);
  const soyCreador = evento.creador_id === sesion?.user.id;
  const marco = { backgroundColor: colores.superficie, borderColor: colores.borde };
  const avisar = (fallo: unknown) => Alert.alert('No se pudo completar', mensajeDeError(fallo));
  const completo = evento.plazas_maximas != null && evento.van >= evento.plazas_maximas;
  const van = asistentes.data?.filter((persona) => persona.respuesta === 'voy') ?? [];
  const quiza = asistentes.data?.filter((persona) => persona.respuesta === 'quiza') ?? [];

  const disponibleDesde = new Date(
    new Date(evento.empieza).getTime() - DIAS_DE_PREVISION * 24 * 60 * 60 * 1000,
  );

  const confirmarEliminar = () =>
    Alert.alert(`Cancelar ${evento.titulo}`, 'Se eliminará para todos, con su chat.', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar quedada',
        style: 'destructive',
        onPress: () => eliminar.mutate(id, { onError: avisar, onSuccess: () => router.back() }),
      },
    ]);

  return (
    <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + espacio.xl }}>
        <View style={estilos.foto}>
          {playa ? (
            <FotoPlaya playa={playa} proporcion={1.3} style={StyleSheet.absoluteFill} />
          ) : null}
          <LinearGradient
            colors={['rgba(4,20,30,0.5)', 'rgba(4,20,30,0.05)', 'rgba(4,20,30,0.88)']}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={estilos.sobreFoto}>
            <Text style={estilos.cuando}>{cuando(evento.empieza)}</Text>
            <Text style={estilos.titulo} accessibilityRole="header">
              {evento.titulo}
            </Text>
            <Text style={estilos.donde}>{evento.playa_nombre}</Text>
          </View>
        </View>

        <View style={estilos.contenido}>
          {evento.me_han_invitado ? (
            <View style={[estilos.aviso, { backgroundColor: colores.sol }]}>
              <Texto variante="cuerpoFuerte" color="sobreSol">
                Te han invitado. ¿Te apuntas?
              </Texto>
            </View>
          ) : null}

          <View style={[estilos.tarjeta, sombra(esOscuro), marco]}>
            <View style={estilos.linea}>
              <Texto variante="subtitulo">
                {evento.plazas_maximas == null
                  ? evento.van === 1
                    ? 'Va 1 persona'
                    : `Van ${evento.van} personas`
                  : `Van ${evento.van} de ${evento.plazas_maximas}`}
              </Texto>
              <Texto variante="etiqueta" color="textoSecundario">
                {evento.grupo_nombre ?? etiquetaVisibilidad[evento.visibilidad]}
              </Texto>
            </View>
            <Segmentado
              etiqueta="Tu respuesta"
              opciones={RESPUESTAS}
              // Sin respuesta aún, ninguna opción aparece marcada.
              valor={(evento.mi_respuesta ?? '') as Respuesta}
              alCambiar={(respuesta) => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                responder.mutate({ evento: id, respuesta }, { onError: avisar });
              }}
            />
            {completo && evento.mi_respuesta !== 'voy' ? (
              <Texto variante="detalle" color="textoSecundario">
                Está completo. Puedes marcar «Quizá» por si queda una plaza libre.
              </Texto>
            ) : null}
          </View>

          {evento.descripcion ? <Texto style={estilos.descripcion}>{evento.descripcion}</Texto> : null}

          {evento.conversacion_id || evento.enlace_whatsapp ? (
            <View style={estilos.bloque}>
              {evento.conversacion_id ? (
                <Boton
                  titulo="Abrir el chat de la quedada"
                  onPress={() =>
                    router.push({
                      pathname: '/chat/[id]',
                      params: { id: evento.conversacion_id ?? '', titulo: evento.titulo },
                    })
                  }
                />
              ) : null}
              {evento.enlace_whatsapp ? (
                <Boton
                  titulo="Unirme al grupo de WhatsApp"
                  variante="secundario"
                  accessibilityRole="link"
                  accessibilityHint="Abre WhatsApp con la invitación al grupo"
                  onPress={() => {
                    if (evento.enlace_whatsapp) Linking.openURL(evento.enlace_whatsapp).catch(avisar);
                  }}
                />
              ) : null}
            </View>
          ) : null}

          <View style={estilos.bloque}>
            <Texto variante="titulo" accessibilityRole="header">
              Cómo estará la playa
            </Texto>
            {prevision.consulta.isPending ? (
              <Esqueleto alto={150} redondeo={radio.l} />
            ) : prevision.enElMomento ? (
              <>
                <View style={[estilos.tarjeta, estilos.enFila, sombra(esOscuro), marco]}>
                  <AnilloPuntuacion
                    valor={prevision.horas.find((hora) => hora.destacada)?.total ?? 0}
                    tamano={64}
                    grosor={6}
                  />
                  <Text style={[estilos.frase, { color: colores.texto }]}>
                    {resumen(prevision.enElMomento, prevision.resguardada ?? false, true)}.
                  </Text>
                </View>
                <PrevisionHoras horas={prevision.horas} />
                <Texto variante="etiqueta" color="textoSecundario">
                  Previsión de Open-Meteo, puntuada según tus preferencias. Puede cambiar.
                </Texto>
              </>
            ) : (
              <Texto color="textoSecundario">
                {disponibleDesde > new Date()
                  ? `Aún es pronto para saberlo. La previsión estará disponible a partir del ${cuando(disponibleDesde).split(',').slice(0, 2).join(',')}.`
                  : 'No hay previsión para ese momento.'}
              </Texto>
            )}
            {playa ? (
              <Boton
                titulo="Ver la playa"
                variante="secundario"
                onPress={() => router.push({ pathname: '/playa/[id]', params: { id: playa.id } })}
              />
            ) : null}
          </View>

          <View style={estilos.bloque}>
            <Texto variante="titulo" accessibilityRole="header">
              Quién va
            </Texto>
            {asistentes.isPending ? (
              <Esqueleto alto={74} redondeo={radio.l} />
            ) : (
              <>
                {van.map((persona) => (
                  <FilaUsuario key={persona.id} usuario={persona}>
                    {persona.id === evento.creador_id ? (
                      <View style={[estilos.sello, { backgroundColor: colores.arena }]}>
                        <Texto variante="etiqueta" color="sobreArena">
                          Organiza
                        </Texto>
                      </View>
                    ) : null}
                  </FilaUsuario>
                ))}
                {quiza.length > 0 ? (
                  <Texto variante="detalle" color="textoSecundario">
                    Quizá: {quiza.map((persona) => persona.nombre_visible).join(', ')}.
                  </Texto>
                ) : null}
              </>
            )}
            {evento.mi_respuesta === 'voy' || evento.mi_respuesta === 'quiza' ? (
              <Boton
                titulo="Invitar amigos"
                variante="secundario"
                onPress={() => router.push({ pathname: '/evento/[id]/invitar', params: { id } })}
              />
            ) : null}
          </View>

          {soyCreador ? (
            <Boton
              titulo="Cancelar la quedada"
              variante="peligro"
              onPress={confirmarEliminar}
              cargando={eliminar.isPending}
            />
          ) : (
            <Boton
              titulo="Reportar a quien organiza"
              variante="peligro"
              onPress={() =>
                router.push({
                  pathname: '/reportar',
                  params: { usuario: evento.creador_id, nombre: evento.creador_nombre },
                })
              }
            />
          )}
        </View>
      </ScrollView>

      <Presionable
        accessibilityLabel="Volver"
        onPress={() => router.back()}
        hitSlop={6}
        style={[estilos.volver, { top: insets.top + espacio.xs }]}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <Feather name="arrow-left" size={22} color="#FFFFFF" />
      </Presionable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  foto: { height: ALTO_FOTO, justifyContent: 'flex-end', backgroundColor: CIELO_ALTO },
  sobreFoto: { padding: espacio.m, paddingBottom: espacio.l, gap: espacio.xxs },
  cuando: { fontFamily: fuentes.textoFuerte, fontSize: 15, lineHeight: 20, color: '#FFD23F' },
  titulo: {
    fontFamily: fuentes.titular,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -0.7,
    color: '#FFFFFF',
  },
  donde: { fontFamily: fuentes.textoMedio, fontSize: 16, lineHeight: 22, color: '#E3EEF3' },
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
  contenido: { paddingHorizontal: espacio.m, paddingTop: espacio.m, gap: espacio.l },
  aviso: { padding: espacio.m, borderRadius: radio.l },
  tarjeta: {
    padding: espacio.m,
    gap: espacio.s,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  enFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  linea: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: espacio.s,
  },
  frase: { flex: 1, fontFamily: fuentes.textoMedio, fontSize: 17, lineHeight: 24 },
  descripcion: { fontSize: 17, lineHeight: 27 },
  bloque: { gap: espacio.s },
  sello: {
    alignSelf: 'center',
    paddingHorizontal: espacio.s,
    paddingVertical: 4,
    borderRadius: radio.completo,
  },
});
