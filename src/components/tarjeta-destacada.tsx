import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { AnilloPuntuacion } from '@/components/anillo-puntuacion';
import { FotoPlaya } from '@/components/foto-playa';
import { FranjaMar } from '@/components/franja-mar';
import { Medida } from '@/components/medida';
import { Presionable } from '@/components/presionable';
import { abrirPlaya } from '@/components/tarjeta-ranking';
import { lugarDe } from '@/data/playas';
import type { PlayaPuntuada } from '@/hooks/use-ranking';
import { nivelPuntuacion, olaEfectiva } from '@/scoring/puntuacion';
import { espacio, fuentes, radio, sombra, useTema } from '@/theme';
import { decimal, etiquetaNivel, resumen } from '@/utils/resumen';

const ALTO_FOTO = 228;

/** La primera del ranking: la respuesta a "¿a qué playa voy hoy?", de un vistazo. */
export function TarjetaDestacada({ entrada, ancho }: { entrada: PlayaPuntuada; ancho: number }) {
  const { colores, esOscuro } = useTema();
  const { playa, condiciones, puntuacion } = entrada;
  const { actual } = condiciones;
  const resguardada = playa.caracteristicas?.resguardada ?? false;
  const olaOrilla = olaEfectiva(actual.olaAltura, resguardada);
  const frase = resumen(actual, resguardada, condiciones.esDeDia);

  return (
    <Presionable
      accessibilityLabel={`La mejor para hoy: ${playa.nombre}, ${lugarDe(playa)}. Puntuación ${puntuacion.total} de 100, ${etiquetaNivel[nivelPuntuacion(puntuacion.total)].toLowerCase()}. ${frase}.`}
      accessibilityHint="Abre el detalle de la playa"
      onPress={() => abrirPlaya(playa.id)}
      style={[
        estilos.tarjeta,
        sombra(esOscuro),
        { backgroundColor: colores.superficie, borderColor: colores.borde },
      ]}>
      <View style={estilos.foto}>
        <FotoPlaya playa={playa} proporcion={ancho / ALTO_FOTO} style={StyleSheet.absoluteFill} />
        {/* Velo para que el texto en blanco se lea sobre cualquier foto. */}
        <LinearGradient
          colors={['rgba(4,20,30,0.42)', 'rgba(4,20,30,0)', 'rgba(4,20,30,0.82)']}
          locations={[0, 0.38, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={estilos.sobreFoto}>
          <View style={[estilos.sello, { backgroundColor: colores.solFijo }]}>
            <Text style={[estilos.textoSello, { color: colores.sobreSol }]}>La mejor para hoy</Text>
          </View>
          <View style={estilos.pie}>
            <View style={estilos.titulo}>
              <Text style={estilos.nombre} numberOfLines={2}>
                {playa.nombre}
              </Text>
              <Text style={estilos.lugar} numberOfLines={1}>
                {lugarDe(playa)}
              </Text>
            </View>
            <AnilloPuntuacion valor={puntuacion.total} tamano={76} grosor={7} sobreFoto />
          </View>
        </View>
      </View>

      <View style={estilos.cuerpo}>
        <Text style={[estilos.frase, { color: colores.texto }]}>{frase}</Text>
        <View style={estilos.medidas}>
          <Medida
            disposicion="columna"
            icono="viento"
            valor={`${Math.round(actual.viento)} km/h`}
            etiqueta="Viento"
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
            valor={actual.tempAgua == null ? 'Sin dato' : `${Math.round(actual.tempAgua)} °C`}
            etiqueta="Agua"
          />
          <Medida
            disposicion="columna"
            icono="uv"
            valor={decimal(actual.uv, 0)}
            etiqueta="Índice UV"
          />
        </View>
      </View>

      <FranjaMar ancho={ancho} altura={olaOrilla} periodo={actual.olaPeriodo} doble />
    </Presionable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    borderRadius: radio.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  foto: { height: ALTO_FOTO },
  sobreFoto: { flex: 1, justifyContent: 'space-between', padding: espacio.m },
  sello: {
    alignSelf: 'flex-start',
    paddingHorizontal: espacio.s,
    paddingVertical: 5,
    borderRadius: radio.completo,
  },
  textoSello: { fontFamily: fuentes.textoFuerte, fontSize: 13, lineHeight: 17 },
  pie: { flexDirection: 'row', alignItems: 'flex-end', gap: espacio.s },
  titulo: { flex: 1, gap: 2 },
  nombre: {
    fontFamily: fuentes.titular,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: '#FFFFFF',
  },
  lugar: { fontFamily: fuentes.textoMedio, fontSize: 15, lineHeight: 20, color: '#E3EEF3' },
  cuerpo: { padding: espacio.m, paddingBottom: espacio.s, gap: espacio.m },
  frase: { fontFamily: fuentes.textoMedio, fontSize: 17, lineHeight: 24 },
  medidas: { flexDirection: 'row', gap: espacio.xs },
});
