import * as Haptics from 'expo-haptics';
import { ScrollView, StyleSheet } from 'react-native';

import { Icono } from '@/components/icono';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import type { Actividad, IdActividad } from '@/data/actividades';
import { espacio, radio, useTema } from '@/theme';

interface Props {
  actividades: Actividad[];
  valor: IdActividad | undefined;
  alCambiar: (actividad: IdActividad) => void;
}

/** Fila deslizable de actividades, cada una con su icono. */
export function SelectorActividad({ actividades, valor, alCambiar }: Props) {
  const { colores } = useTema();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.contenido}
      accessibilityRole="tablist"
      accessibilityLabel="Actividad">
      {actividades.map((actividad) => {
        const activa = actividad.id === valor;
        return (
          <Presionable
            key={actividad.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            onPress={() => {
              if (activa) return;
              Haptics.selectionAsync();
              alCambiar(actividad.id);
            }}
            style={[
              estilos.chip,
              {
                backgroundColor: activa ? colores.primario : colores.superficie,
                borderColor: activa ? colores.primario : colores.borde,
              },
            ]}>
            <Icono
              nombre={actividad.icono}
              tamano={20}
              color={activa ? colores.sobrePrimario : colores.primario}
            />
            <Texto variante="cuerpoFuerte" color={activa ? 'sobrePrimario' : 'texto'}>
              {actividad.nombre}
            </Texto>
          </Presionable>
        );
      })}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { gap: espacio.xs, paddingHorizontal: espacio.m, paddingVertical: espacio.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    minHeight: 48,
    paddingHorizontal: espacio.m,
    borderRadius: radio.completo,
    borderWidth: 1,
  },
});
