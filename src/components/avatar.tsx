import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { CLAVE_ANONIMA, URL_SUPABASE } from '@/lib/supabase';
import { useSesion } from '@/sesion/contexto';
import { fuentes, useTema } from '@/theme';

interface Props {
  /** Ruta de la foto en el bucket "avatares", o `null` si no tiene. */
  ruta: string | null;
  nombre: string;
  tamano?: number;
}

/** Foto de perfil. Sin foto, la inicial del nombre sobre arena. */
export function Avatar({ ruta, nombre, tamano = 56 }: Props) {
  const { colores } = useTema();
  const { sesion } = useSesion();
  const forma = { width: tamano, height: tamano, borderRadius: tamano / 2 };

  return (
    <View
      style={[
        estilos.marco,
        forma,
        { backgroundColor: colores.arena, borderColor: colores.superficie },
      ]}>
      {ruta && sesion ? (
        <Image
          // El bucket es privado: la foto se pide con la sesión del usuario.
          source={{
            uri: `${URL_SUPABASE}/storage/v1/object/authenticated/avatares/${ruta}`,
            headers: { Authorization: `Bearer ${sesion.access_token}`, apikey: CLAVE_ANONIMA },
          }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          accessible={false}
        />
      ) : (
        <Text
          style={[estilos.inicial, { fontSize: tamano * 0.42, color: colores.sobreArena }]}
          allowFontScaling={false}>
          {nombre.trim().charAt(0).toUpperCase() || '?'}
        </Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  inicial: { fontFamily: fuentes.titular },
});
