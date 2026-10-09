import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { duracionCorta } from '@/social/voz';
import { espacio, fuentes, useTema } from '@/theme';

interface Props {
  duracionMs: number;
  /** Parte ya escuchada, de 0 a 1. */
  progreso: number;
  sonando: boolean;
  /** Mientras se pide el audio al servidor. */
  cargando: boolean;
  /** Va sobre la burbuja azul de mis mensajes. */
  mio: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

/** Contenido de una burbuja de nota de voz: reproducir o pausar, avance y duración. */
export function NotaVoz({
  duracionMs,
  progreso,
  sonando,
  cargando,
  mio,
  onPress,
  onLongPress,
}: Props) {
  const { colores, esOscuro } = useTema();
  // Sobre mi burbuja: velo claro en el azul oscuro de día, velo oscuro en el azul claro de noche.
  const velo = esOscuro ? 'rgba(4,32,47,0.2)' : 'rgba(255,255,255,0.24)';
  const tinta = mio ? colores.sobrePrimario : colores.primario;
  const escuchado = Math.min(1, Math.max(0, progreso));
  const restante = duracionMs * (sonando || escuchado > 0 ? 1 - escuchado : 1);

  return (
    <View style={estilos.nota}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sonando ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
        accessibilityState={{ busy: cargando }}
        hitSlop={8}
        onPress={onPress}
        onLongPress={onLongPress}
        style={[estilos.boton, { backgroundColor: mio ? velo : colores.fondo }]}>
        {cargando ? (
          <ActivityIndicator size="small" color={tinta} />
        ) : (
          <Feather
            name={sonando ? 'pause' : 'play'}
            size={20}
            color={tinta}
            style={sonando ? undefined : estilos.triangulo}
          />
        )}
      </Pressable>
      <View style={estilos.avance}>
        <View style={[estilos.pista, { backgroundColor: mio ? velo : colores.borde }]}>
          <View
            style={[estilos.relleno, { backgroundColor: tinta, width: `${escuchado * 100}%` }]}
          />
        </View>
        <Text style={[estilos.tiempo, { color: mio ? colores.sobrePrimario : colores.texto }]}>
          {duracionCorta(restante)}
        </Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  nota: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, width: 210 },
  boton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El triángulo de reproducir se ve descentrado si no se empuja un poco a la derecha.
  triangulo: { marginLeft: 3 },
  avance: { flex: 1, gap: espacio.xxs + 2 },
  pista: { height: 4, borderRadius: 2, overflow: 'hidden' },
  relleno: { height: 4, borderRadius: 2 },
  tiempo: { fontFamily: fuentes.textoMedio, fontSize: 13, fontVariant: ['tabular-nums'] },
});
