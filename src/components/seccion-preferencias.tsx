import * as Haptics from 'expo-haptics';
import { StyleSheet, Switch, View } from 'react-native';

import { Seccion } from '@/components/seccion';
import { Segmentado } from '@/components/segmentado';
import { Texto } from '@/components/texto';
import { usePreferencias, type Interes } from '@/preferencias/contexto';
import type { Plan, ToleranciaViento } from '@/scoring/puntuacion';
import { espacio, useTema } from '@/theme';

const INTERESES: { valor: Interes; etiqueta: string }[] = [
  { valor: 'playa', etiqueta: 'Playa' },
  { valor: 'senderismo', etiqueta: 'Senderismo' },
  { valor: 'todo', etiqueta: 'Todo' },
];

const PLANES: { valor: Plan; etiqueta: string }[] = [
  { valor: 'bano', etiqueta: 'Baño' },
  { valor: 'surf', etiqueta: 'Surf' },
  { valor: 'ninos', etiqueta: 'Niños' },
  { valor: 'snorkel', etiqueta: 'Snorkel' },
];

const TOLERANCIAS: { valor: ToleranciaViento; etiqueta: string }[] = [
  { valor: 'baja', etiqueta: 'Poco' },
  { valor: 'media', etiqueta: 'Normal' },
  { valor: 'alta', etiqueta: 'Mucho' },
];

const AYUDA_VIENTO: Record<ToleranciaViento, string> = {
  baja: 'Te molesta a partir de una brisa de 12 km/h.',
  media: 'Estás a gusto hasta unos 20 km/h.',
  alta: 'Aguantas bien hasta unos 28 km/h.',
};

/** Qué plan buscas, cuánto viento toleras y si te afecta la calima. */
export function SeccionPreferencias() {
  const { colores } = useTema();
  const { preferencias, cambiar } = usePreferencias();

  return (
    <Seccion
      titulo="Tus preferencias"
      descripcion="Qué te enseñamos primero y cómo se puntúa cada sitio.">
      <View style={estilos.ajuste}>
        <Texto variante="cuerpoFuerte">Qué te interesa</Texto>
        <Segmentado
          etiqueta="Qué te interesa"
          opciones={INTERESES}
          valor={preferencias.interes ?? 'todo'}
          alCambiar={(interes) => cambiar({ interes })}
        />
        <Texto variante="detalle" color="textoSecundario">
          Decide por dónde empieza Explorar y qué se destaca en Inicio.
        </Texto>
      </View>

      <View style={estilos.ajuste}>
        <Texto variante="cuerpoFuerte">Qué plan de playa buscas</Texto>
        <Segmentado
          etiqueta="Qué plan buscas"
          opciones={PLANES}
          valor={preferencias.plan}
          alCambiar={(plan) => cambiar({ plan })}
        />
      </View>

      <View style={estilos.ajuste}>
        <Texto variante="cuerpoFuerte">Cuánto viento toleras</Texto>
        <Segmentado
          etiqueta="Cuánto viento toleras"
          opciones={TOLERANCIAS}
          valor={preferencias.toleranciaViento}
          alCambiar={(toleranciaViento) => cambiar({ toleranciaViento })}
        />
        <Texto variante="detalle" color="textoSecundario">
          {AYUDA_VIENTO[preferencias.toleranciaViento]}
        </Texto>
      </View>

      <View style={estilos.interruptor}>
        <View style={estilos.textos}>
          <Texto variante="cuerpoFuerte">Soy sensible a la calima</Texto>
          <Texto variante="detalle" color="textoSecundario">
            Los días de polvo en suspensión pesan el doble en tu ranking.
          </Texto>
        </View>
        <Switch
          accessibilityLabel="Soy sensible a la calima"
          value={preferencias.sensibleCalima}
          onValueChange={(sensibleCalima) => {
            Haptics.selectionAsync();
            cambiar({ sensibleCalima });
          }}
          trackColor={{ true: colores.primario, false: colores.borde }}
        />
      </View>
    </Seccion>
  );
}

const estilos = StyleSheet.create({
  ajuste: { gap: espacio.xs },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, minHeight: 48 },
  textos: { flex: 1, gap: 2 },
});
