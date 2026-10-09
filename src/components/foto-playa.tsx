import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CIELO_ALTO, IlustracionPlaya } from '@/components/ilustracion-playa';
import type { Playa } from '@/data/playas';

/**
 * Wikimedia rechaza (403) las peticiones sin un User-Agent que identifique a la app,
 * como el que envía Android por defecto.
 */
const CABECERAS = { 'User-Agent': 'Planeo/0.1 (prototipo Expo; playas de Gran Canaria)' };

interface Props {
  playa: Playa;
  /** 'miniatura' pide la versión de 330 px, suficiente para las tarjetas compactas. */
  tamano?: 'miniatura' | 'grande';
  /** Ancho entre alto del contenedor; encuadra la ilustración de respaldo. */
  proporcion: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Foto real de la playa. Si no tiene foto o no carga (sin conexión, enlace roto),
 * se muestra la ilustración de su tipo de costa.
 */
export function FotoPlaya({ playa, tamano = 'grande', proporcion, style }: Props) {
  const [fallo, setFallo] = useState(false);
  const conFoto = playa.foto != null && !fallo;
  const grande = playa.foto?.url;
  const uri = tamano === 'miniatura' ? grande?.replace('/960px-', '/330px-') : grande;

  return (
    <View style={[estilos.marco, style]}>
      {conFoto ? (
        <Image
          source={{ uri, headers: CABECERAS }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={350}
          onError={() => setFallo(true)}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : (
        <IlustracionPlaya tipo={playa.tipo ?? 'arena'} proporcion={proporcion} />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: { overflow: 'hidden', backgroundColor: CIELO_ALTO },
});
