import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, StyleSheet, View } from 'react-native';

import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { cuando } from '@/social/eventos';
import { espacio, radio, TACTIL_MINIMO, useTema } from '@/theme';

interface Props {
  etiqueta: string;
  valor: Date;
  alCambiar: (valor: Date) => void;
  /** No se puede elegir un momento anterior. */
  minimo: Date;
}

/**
 * Fecha y hora con el selector nativo de cada plataforma: en iOS, el control compacto
 * en la propia fila; en Android, dos diálogos seguidos (día y hora).
 */
export function CampoFechaHora({ etiqueta, valor, alCambiar, minimo }: Props) {
  const { colores, esOscuro } = useTema();

  const abrirEnAndroid = () => {
    DateTimePickerAndroid.open({
      value: valor,
      mode: 'date',
      minimumDate: minimo,
      onChange: (evento, dia) => {
        if (evento.type !== 'set' || !dia) return;
        DateTimePickerAndroid.open({
          value: valor,
          mode: 'time',
          is24Hour: true,
          onChange: (eventoHora, hora) => {
            if (eventoHora.type !== 'set' || !hora) return;
            const elegido = new Date(dia);
            elegido.setHours(hora.getHours(), hora.getMinutes(), 0, 0);
            alCambiar(elegido);
          },
        });
      },
    });
  };

  return (
    <View style={estilos.campo}>
      <Texto variante="etiqueta" color="textoSecundario">
        {etiqueta}
      </Texto>
      {Platform.OS === 'android' ? (
        <Presionable
          accessibilityLabel={`${etiqueta}: ${cuando(valor)}`}
          accessibilityHint="Abre el selector de fecha y hora"
          onPress={abrirEnAndroid}
          style={[
            estilos.caja,
            { backgroundColor: colores.superficie, borderColor: colores.borde },
          ]}>
          <Texto>{cuando(valor)}</Texto>
        </Presionable>
      ) : (
        <View
          style={[
            estilos.caja,
            { backgroundColor: colores.superficie, borderColor: colores.borde },
          ]}>
          <DateTimePicker
            value={valor}
            mode="datetime"
            display="compact"
            locale="es-ES"
            minimumDate={minimo}
            minuteInterval={5}
            themeVariant={esOscuro ? 'dark' : 'light'}
            accentColor={colores.primario}
            onChange={(_, elegido) => {
              if (elegido) alCambiar(elegido);
            }}
          />
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espacio.xxs + 2 },
  caja: {
    minHeight: TACTIL_MINIMO + 4,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.xs,
    borderRadius: radio.m,
    borderWidth: 1,
  },
});
