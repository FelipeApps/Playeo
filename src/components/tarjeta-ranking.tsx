import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AnilloPuntuacion } from '@/components/anillo-puntuacion';
import { FotoPlaya } from '@/components/foto-playa';
import { FranjaMar } from '@/components/franja-mar';
import { Medida } from '@/components/medida';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { lugarDe } from '@/data/playas';
import type { PlayaPuntuada } from '@/hooks/use-ranking';
import { nivelPuntuacion, olaEfectiva } from '@/scoring/puntuacion';
import { espacio, fuentes, radio, sombra, useTema } from '@/theme';
import { decimal, estadoMar, estadoViento, etiquetaNivel, resumen } from '@/utils/resumen';

const ANCHO_FOTO = 92;

interface Props {
  entrada: PlayaPuntuada;
  /** Puesto en el ranking, empezando en 1. */
  puesto: number;
  ancho: number;
  /** Retardo del anillo en ms, acompasado con la entrada de la tarjeta. */
  retardo?: number;
}

export function abrirPlaya(id: string) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  router.push({ pathname: '/playa/[id]', params: { id } });
}

export function TarjetaRanking({ entrada, puesto, ancho, retardo }: Props) {
  const { colores, esOscuro } = useTema();
  const { playa, condiciones, puntuacion } = entrada;
  const { actual } = condiciones;
  const resguardada = playa.caracteristicas?.resguardada ?? false;
  const olaOrilla = olaEfectiva(actual.olaAltura, resguardada);
  const frase = resumen(actual, resguardada, condiciones.esDeDia);
  const viento = `${estadoViento(actual.viento)}, ${Math.round(actual.viento)} km/h`;
  const mar =
    olaOrilla == null ? estadoMar(null) : `${estadoMar(olaOrilla)}, ${decimal(olaOrilla)} m`;

  return (
    <Presionable
      accessibilityLabel={`Puesto ${puesto}: ${playa.nombre}, ${lugarDe(playa)}. Puntuación ${puntuacion.total} de 100, ${etiquetaNivel[nivelPuntuacion(puntuacion.total)].toLowerCase()}. ${frase}. ${viento}. ${mar}.`}
      accessibilityHint="Abre el detalle de la playa"
      onPress={() => abrirPlaya(playa.id)}
      style={[
        estilos.tarjeta,
        sombra(esOscuro),
        { backgroundColor: colores.superficie, borderColor: colores.borde },
      ]}>
      <View style={estilos.cuerpo}>
        <View>
          <FotoPlaya
            playa={playa}
            tamano="miniatura"
            proporcion={ANCHO_FOTO / 112}
            style={estilos.foto}
          />
          <View style={[estilos.puesto, { backgroundColor: colores.superficie }]}>
            <Text style={[estilos.cifraPuesto, { color: colores.texto }]} allowFontScaling={false}>
              {puesto}
            </Text>
          </View>
        </View>

        <View style={estilos.textos}>
          <View style={estilos.cabecera}>
            <View style={estilos.nombre}>
              <Texto variante="subtitulo" numberOfLines={2}>
                {playa.nombre}
              </Texto>
              <Texto variante="etiqueta" color="textoSecundario" numberOfLines={1}>
                {lugarDe(playa)}
              </Texto>
            </View>
            <AnilloPuntuacion valor={puntuacion.total} tamano={54} grosor={5} retardo={retardo} />
          </View>

          <Texto variante="detalle" color="textoSecundario" numberOfLines={2}>
            {frase}
          </Texto>

          <View style={estilos.medidas}>
            <Medida icono="viento" valor={`${Math.round(actual.viento)} km/h`} etiqueta="Viento" />
            <Medida
              icono="ola"
              valor={olaOrilla == null ? 'Sin dato' : `${decimal(olaOrilla)} m`}
              etiqueta="Oleaje"
            />
          </View>
        </View>
      </View>

      <FranjaMar ancho={ancho} altura={olaOrilla} periodo={actual.olaPeriodo} />
    </Presionable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cuerpo: {
    flexDirection: 'row',
    gap: espacio.s,
    padding: espacio.s,
    paddingBottom: espacio.xs,
  },
  foto: { width: ANCHO_FOTO, flex: 1, minHeight: 112, borderRadius: radio.m },
  puesto: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cifraPuesto: { fontFamily: fuentes.titulo, fontSize: 14 },
  textos: { flex: 1, gap: espacio.xs, paddingVertical: 2 },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs },
  nombre: { flex: 1, gap: 1 },
  medidas: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.m, rowGap: espacio.xxs },
});
