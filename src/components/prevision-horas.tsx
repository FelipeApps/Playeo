import { ScrollView, StyleSheet, View } from 'react-native';

import { AnilloPuntuacion } from '@/components/anillo-puntuacion';
import { Icono } from '@/components/icono';
import { Texto } from '@/components/texto';
import { espacio, radio, useTema } from '@/theme';
import { decimal } from '@/utils/resumen';

export interface HoraPrevista {
  /** Hora local a mostrar, de 0 a 23. */
  hora: number;
  total: number;
  /** km/h */
  viento: number;
  /** Altura de ola en la orilla, en metros. En el monte no se indica. */
  ola?: number | null;
  /** Probabilidad de lluvia, %. Para el monte, en lugar de la ola. */
  lluvia?: number;
  /** Para destacar la hora actual o la del evento. */
  destacada?: boolean;
}

/** Tira horizontal con la puntuación, el viento y la ola de cada hora. */
export function PrevisionHoras({ horas }: { horas: HoraPrevista[] }) {
  const { colores } = useTema();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.tira}
      accessibilityLabel="Previsión por horas">
      {horas.map((prevista) => (
        <View
          key={prevista.hora}
          accessible
          accessibilityLabel={`A las ${prevista.hora}: puntuación ${prevista.total}, viento ${Math.round(prevista.viento)} kilómetros por hora${prevista.ola == null ? '' : `, ola de ${decimal(prevista.ola)} metros`}${prevista.lluvia == null ? '' : `, ${Math.round(prevista.lluvia)} por ciento de probabilidad de lluvia`}`}
          style={[
            estilos.celda,
            {
              backgroundColor: prevista.destacada ? colores.arena : colores.superficie,
              borderColor: prevista.destacada ? colores.sol : colores.borde,
              borderWidth: prevista.destacada ? 2 : StyleSheet.hairlineWidth,
            },
          ]}>
          <Texto variante="etiqueta" color={prevista.destacada ? 'sobreArena' : 'textoSecundario'}>
            {prevista.hora}:00
          </Texto>
          <AnilloPuntuacion valor={prevista.total} tamano={44} grosor={4} />
          <View style={estilos.dato}>
            <Icono nombre="viento" tamano={14} color={colores.primario} />
            <Texto variante="etiqueta">{Math.round(prevista.viento)}</Texto>
          </View>
          {prevista.lluvia == null ? (
            <View style={estilos.dato}>
              <Icono nombre="ola" tamano={14} color={colores.primario} />
              <Texto variante="etiqueta">
                {prevista.ola == null ? '–' : decimal(prevista.ola)}
              </Texto>
            </View>
          ) : (
            <View style={estilos.dato}>
              <Icono nombre="lluvia" tamano={14} color={colores.primario} />
              <Texto variante="etiqueta">{Math.round(prevista.lluvia)} %</Texto>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tira: { gap: espacio.xs, paddingVertical: espacio.xxs },
  celda: {
    width: 68,
    alignItems: 'center',
    gap: espacio.xxs + 2,
    paddingVertical: espacio.s,
    borderRadius: radio.m,
  },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
