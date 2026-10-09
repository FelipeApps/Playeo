import { StyleSheet, View } from 'react-native';

import { Icono } from '@/components/icono';
import { Texto } from '@/components/texto';
import type { NivelCalima } from '@/scoring/puntuacion';
import { espacio, radio, useTema } from '@/theme';

interface Props {
  nivel: Exclude<NivelCalima, 'ninguna'>;
  /** Polvo en suspensión más alto registrado, en µg/m³. */
  polvo: number;
  sensible: boolean;
}

const TEXTOS = {
  ligera: {
    titulo: 'Calima ligera',
    consejo: 'El aire está algo cargado de polvo y hay menos visibilidad.',
    sensible: 'Como eres sensible a la calima, hoy pesa más en tu ranking.',
  },
  fuerte: {
    titulo: 'Calima fuerte',
    consejo: 'Mucho polvo en suspensión. Mejor evitar el ejercicio intenso al aire libre.',
    sensible: 'Como eres sensible a la calima, hoy ninguna playa pasa de 45 puntos.',
  },
};

/** Aviso destacado de calima sobre el ranking. */
export function AvisoCalima({ nivel, polvo, sensible }: Props) {
  const { colores } = useTema();
  const textos = TEXTOS[nivel];

  return (
    <View
      accessible
      accessibilityRole="alert"
      style={[
        estilos.aviso,
        { backgroundColor: colores.fondoCalima, borderColor: colores.calima },
      ]}>
      <View style={[estilos.medallon, { backgroundColor: colores.calima }]}>
        <Icono nombre="calima" color={colores.fondoCalima} />
      </View>
      <View style={estilos.textos}>
        <Texto variante="subtitulo" color="textoCalima">
          {textos.titulo}
        </Texto>
        <Texto variante="detalle" color="textoCalima">
          {textos.consejo} {sensible ? textos.sensible : ''}
        </Texto>
        {polvo > 0 ? (
          <Texto variante="etiqueta" color="textoCalima">
            Polvo en suspensión: {Math.round(polvo)} µg/m³
          </Texto>
        ) : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    gap: espacio.s,
    padding: espacio.m,
    borderRadius: radio.l,
    borderWidth: 1,
  },
  medallon: {
    width: 44,
    height: 44,
    borderRadius: radio.completo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, gap: espacio.xxs },
});
