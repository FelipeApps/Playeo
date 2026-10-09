import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { espacio, radio, useTema } from '@/theme';

interface Props<T extends string> {
  /** Qué se está eligiendo, para lectores de pantalla. */
  etiqueta: string;
  opciones: readonly { valor: T; etiqueta: string }[];
  valor: T;
  alCambiar: (valor: T) => void;
}

/** Selector de una opción entre pocas, todas a la vista. */
export function Segmentado<T extends string>({ etiqueta, opciones, valor, alCambiar }: Props<T>) {
  const { colores } = useTema();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={etiqueta}
      style={[estilos.pista, { backgroundColor: colores.fondo, borderColor: colores.borde }]}>
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <View key={opcion.valor} style={estilos.hueco}>
            <Presionable
              accessibilityRole="radio"
              accessibilityState={{ checked: activa }}
              onPress={() => {
                if (activa) return;
                Haptics.selectionAsync();
                alCambiar(opcion.valor);
              }}
              style={[estilos.opcion, activa && { backgroundColor: colores.primario }]}>
              <Texto
                variante="etiqueta"
                color={activa ? 'sobrePrimario' : 'texto'}
                numberOfLines={1}
                style={estilos.texto}>
                {opcion.etiqueta}
              </Texto>
            </Presionable>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  pista: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radio.m,
    borderWidth: 1,
  },
  hueco: { flex: 1 },
  opcion: {
    minHeight: 44,
    paddingHorizontal: espacio.xs,
    borderRadius: radio.s + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { fontSize: 14 },
});
