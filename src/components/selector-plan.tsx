import * as Haptics from 'expo-haptics';
import { ScrollView, StyleSheet } from 'react-native';

import { Icono, type NombreIcono } from '@/components/icono';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import type { Plan } from '@/scoring/puntuacion';
import { espacio, radio, useTema } from '@/theme';
import { etiquetaPlan } from '@/utils/resumen';

const PLANES: { plan: Plan; icono: NombreIcono }[] = [
  { plan: 'bano', icono: 'ola' },
  { plan: 'surf', icono: 'surf' },
  { plan: 'ninos', icono: 'ninos' },
  { plan: 'snorkel', icono: 'snorkel' },
];

interface Props {
  plan: Plan;
  alCambiar: (plan: Plan) => void;
}

/** Cambia el plan del día; el ranking se reordena al momento. */
export function SelectorPlan({ plan, alCambiar }: Props) {
  const { colores } = useTema();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.contenido}
      accessibilityRole="tablist"
      accessibilityLabel="Qué plan buscas hoy">
      {PLANES.map((opcion) => {
        const activo = opcion.plan === plan;
        return (
          <Presionable
            key={opcion.plan}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            onPress={() => {
              if (activo) return;
              Haptics.selectionAsync();
              alCambiar(opcion.plan);
            }}
            style={[
              estilos.chip,
              {
                backgroundColor: activo ? colores.primario : colores.superficie,
                borderColor: activo ? colores.primario : colores.borde,
              },
            ]}>
            <Icono
              nombre={opcion.icono}
              tamano={20}
              color={activo ? colores.sobrePrimario : colores.primario}
            />
            <Texto variante="cuerpoFuerte" color={activo ? 'sobrePrimario' : 'texto'}>
              {etiquetaPlan[opcion.plan]}
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
