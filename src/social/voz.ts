import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type RecordingOptions,
} from 'expo-audio';

import { supabase } from '@/lib/supabase';

const BUCKET = 'notas-voz';

/** Duración máxima de una nota, en segundos. La base de datos rechaza las más largas. */
export const SEGUNDOS_MAXIMOS = 120;
/** Por debajo de esto se entiende que fue un toque sin querer. */
export const MILISEGUNDOS_MINIMOS = 700;

/** Voz en mono a 48 kb/s: se entiende bien y dos minutos pesan menos de 1 MB. */
export const AJUSTES_GRABACION: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 48000,
  web: { mimeType: 'audio/webm', bitsPerSecond: 48000 },
};

/** Pide el micrófono y deja el audio listo para grabar. Falso si no hay permiso. */
export async function prepararMicrofono(): Promise<boolean> {
  const { granted } = await requestRecordingPermissionsAsync();
  if (!granted) return false;
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  return true;
}

/** Vuelve al modo de escucha: suena por el altavoz y también con el móvil en silencio. */
export function prepararEscucha() {
  return setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
}

/** Sube la grabación a la carpeta del autor en esa conversación y devuelve su ruta. */
export async function subirNota(autor: string, conversacion: string, uri: string) {
  const esWebm = uri.endsWith('.webm') || uri.startsWith('blob:');
  const ruta = `${autor}/${conversacion}/${Date.now()}.${esWebm ? 'webm' : 'm4a'}`;
  const datos = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, datos, { contentType: esWebm ? 'audio/webm' : 'audio/mp4' });
  if (error) throw error;
  return ruta;
}

export function borrarNota(ruta: string) {
  return supabase.storage.from(BUCKET).remove([ruta]);
}

// Las direcciones firmadas valen una hora; se reutilizan algo menos para no apurar.
const VIGENCIA_FIRMA = 60 * 60;
const firmadas = new Map<string, { url: string; caduca: number }>();

/** Dirección temporal para oír una nota. Solo se obtiene si puedo leer su mensaje. */
export async function urlDeNota(ruta: string): Promise<string> {
  const guardada = firmadas.get(ruta);
  if (guardada && guardada.caduca > Date.now()) return guardada.url;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, VIGENCIA_FIRMA);
  if (error) throw error;
  firmadas.set(ruta, {
    url: data.signedUrl,
    caduca: Date.now() + (VIGENCIA_FIRMA - 300) * 1000,
  });
  return data.signedUrl;
}

/** "0:07", "1:32". */
export function duracionCorta(milisegundos: number): string {
  const segundos = Math.max(0, Math.round(milisegundos / 1000));
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}
