import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Texto } from '@/components/texto';
import { espacio, fuentes, radio, TACTIL_MINIMO, useTema } from '@/theme';

interface Props extends TextInputProps {
  etiqueta: string;
  /** Texto de apoyo bajo el campo. Lo sustituye el error cuando lo hay. */
  ayuda?: string;
  error?: string;
}

/** Campo de formulario con etiqueta siempre visible y el error junto al campo. */
export function CampoTexto({ etiqueta, ayuda, error, style, onFocus, onBlur, ...resto }: Props) {
  const { colores } = useTema();
  const [enfocado, setEnfocado] = useState(false);
  const borde = error ? colores.error : enfocado ? colores.primario : colores.borde;

  return (
    <View style={estilos.campo}>
      <Texto variante="etiqueta" color="textoSecundario">
        {etiqueta}
      </Texto>
      <TextInput
        accessibilityLabel={etiqueta}
        accessibilityHint={error ?? ayuda}
        placeholderTextColor={colores.textoSecundario}
        selectionColor={colores.primario}
        onFocus={(evento) => {
          setEnfocado(true);
          onFocus?.(evento);
        }}
        onBlur={(evento) => {
          setEnfocado(false);
          onBlur?.(evento);
        }}
        style={[
          estilos.entrada,
          {
            color: colores.texto,
            backgroundColor: colores.superficie,
            borderColor: borde,
            borderWidth: enfocado || error ? 2 : 1,
          },
          style,
        ]}
        {...resto}
      />
      {error ? (
        <Texto variante="etiqueta" color="error" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : ayuda ? (
        <Texto variante="etiqueta" color="textoSecundario">
          {ayuda}
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espacio.xxs + 2 },
  entrada: {
    minHeight: TACTIL_MINIMO + 4,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderRadius: radio.m,
    fontFamily: fuentes.texto,
    fontSize: 17,
  },
});
