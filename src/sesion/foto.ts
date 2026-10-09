import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

/**
 * Abre la galería, recorta la foto en cuadrado y la sube a la carpeta del usuario.
 * Devuelve la ruta nueva, o `null` si se canceló. La foto anterior se borra.
 */
export async function elegirYSubirFoto(
  idUsuario: string,
  rutaAnterior: string | null,
): Promise<string | null> {
  const eleccion = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });
  if (eleccion.canceled) return null;

  const foto = eleccion.assets[0];
  const tipo = foto.mimeType ?? 'image/jpeg';
  const extension = tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg';
  // Nombre nuevo en cada subida para que la caché de imágenes no enseñe la foto vieja.
  const ruta = `${idUsuario}/${Date.now()}.${extension}`;

  const datos = await (await fetch(foto.uri)).arrayBuffer();
  const { error } = await supabase.storage
    .from('avatares')
    .upload(ruta, datos, { contentType: tipo });
  if (error) throw error;

  if (rutaAnterior) await supabase.storage.from('avatares').remove([rutaAnterior]);
  return ruta;
}
