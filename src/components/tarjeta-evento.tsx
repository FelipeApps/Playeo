import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FotoPlaya } from '@/components/foto-playa';
import { IlustracionActividad } from '@/components/ilustracion-actividad';
import { CIELO_ALTO } from '@/components/ilustracion-playa';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { buscarPlaya } from '@/data/playas';
import { cuando, etiquetaRespuesta, type Respuesta } from '@/social/eventos';
import { espacio, radio, sombra, useTema } from '@/theme';

export interface EventoResumido {
  id: string;
  titulo: string;
  empieza: string;
  actividad_id: string;
  actividad_nombre: string;
  /** Nulo cuando el sitio se escribió a mano. */
  lugar_id: string | null;
  /** Nombre del lugar del catálogo o del sitio escrito a mano. */
  lugar_nombre: string;
  grupo_nombre: string | null;
  creador_nombre: string;
  plazas_maximas: number | null;
  van: number;
  mi_respuesta: Respuesta | null;
  me_han_invitado: boolean;
}

/** Una quedada en la lista: foto del lugar (si es una playa), cuándo, dónde y mi situación. */
export function TarjetaEvento({ evento }: { evento: EventoResumido }) {
  const { colores, esOscuro } = useTema();
  const playa = evento.lugar_id ? buscarPlaya(evento.lugar_id) : undefined;

  const asistencia =
    evento.plazas_maximas == null
      ? evento.van === 1
        ? 'Va 1 persona'
        : `Van ${evento.van} personas`
      : `Van ${evento.van} de ${evento.plazas_maximas}`;
  const situacion = evento.me_han_invitado
    ? 'Te han invitado'
    : evento.mi_respuesta
      ? etiquetaRespuesta[evento.mi_respuesta]
      : null;

  return (
    <Presionable
      accessibilityLabel={`${evento.actividad_nombre}: ${evento.titulo}. ${cuando(evento.empieza)}, en ${evento.lugar_nombre}. ${asistencia}. ${situacion ?? ''}`}
      accessibilityHint="Abre la quedada"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/evento/[id]', params: { id: evento.id } });
      }}
      style={[
        estilos.tarjeta,
        sombra(esOscuro),
        { backgroundColor: colores.superficie, borderColor: colores.borde },
      ]}>
      {playa ? (
        <FotoPlaya playa={playa} tamano="miniatura" proporcion={0.8} style={estilos.foto} />
      ) : (
        <View style={[estilos.foto, { backgroundColor: CIELO_ALTO }]}>
          <IlustracionActividad actividad={evento.actividad_id} proporcion={0.8} />
        </View>
      )}
      <View style={estilos.textos}>
        <Texto variante="etiqueta" color="primario">
          {evento.actividad_nombre}, {cuando(evento.empieza, true)}
        </Texto>
        <Texto variante="subtitulo" numberOfLines={2}>
          {evento.titulo}
        </Texto>
        <Texto variante="detalle" color="textoSecundario" numberOfLines={1}>
          {evento.lugar_nombre}
          {evento.grupo_nombre ? `, con ${evento.grupo_nombre}` : `, de ${evento.creador_nombre}`}
        </Texto>
        <View style={estilos.pie}>
          <Texto variante="etiqueta" color="textoSecundario">
            {asistencia}
          </Texto>
          {situacion ? (
            <View
              style={[
                estilos.sello,
                { backgroundColor: evento.me_han_invitado ? colores.sol : colores.arena },
              ]}>
              <Texto variante="etiqueta" color={evento.me_han_invitado ? 'sobreSol' : 'sobreArena'}>
                {situacion}
              </Texto>
            </View>
          ) : null}
        </View>
      </View>
    </Presionable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    gap: espacio.s,
    padding: espacio.s,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  foto: { width: 88, minHeight: 110, borderRadius: radio.m, overflow: 'hidden' },
  textos: { flex: 1, gap: 2, justifyContent: 'center' },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio.xs,
    marginTop: espacio.xxs,
  },
  sello: { paddingHorizontal: espacio.s, paddingVertical: 3, borderRadius: radio.completo },
});
