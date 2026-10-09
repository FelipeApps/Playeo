import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components/texto';
import { espacio, useTema } from '@/theme';

interface Props {
  marcada: boolean;
  alCambiar: (marcada: boolean) => void;
  etiqueta: string;
}

/** Casilla de verificación con toda la fila como área táctil. */
export function Casilla({ marcada, alCambiar, etiqueta }: Props) {
  const { colores } = useTema();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      onPress={() => {
        Haptics.selectionAsync();
        alCambiar(!marcada);
      }}
      style={estilos.fila}>
      <View
        style={[
          estilos.caja,
          {
            backgroundColor: marcada ? colores.primario : colores.superficie,
            borderColor: marcada ? colores.primario : colores.textoSecundario,
          },
        ]}>
        {marcada ? <Feather name="check" size={18} color={colores.sobrePrimario} /> : null}
      </View>
      <Texto style={estilos.texto}>{etiqueta}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, minHeight: 48 },
  caja: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { flex: 1 },
});
