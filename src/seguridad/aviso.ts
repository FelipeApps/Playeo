import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

const HORA = 60 * 60 * 1000;
/** Lo máximo que se espera al GPS antes de tirar de la última posición conocida. */
const ESPERA_GPS = 8000;

export const TELEFONO_EMERGENCIAS = '112';

export interface QuedadaCercana {
  titulo: string;
  lugar_nombre: string | null;
  empieza: string;
}

interface QuedadaConRespuesta extends QuedadaCercana {
  mi_respuesta: string | null;
}

/**
 * La quedada a la que voy que está ocurriendo ahora o a punto de empezar, si la hay.
 * Sirve para decirle al contacto con quién y dónde había quedado.
 */
export function quedadaEnCurso<T extends QuedadaConRespuesta>(
  eventos: T[] | undefined,
  ahora: number,
): T | undefined {
  return eventos
    ?.filter((evento) => {
      const empieza = new Date(evento.empieza).getTime();
      return (
        evento.mi_respuesta === 'voy' && empieza - ahora < 2 * HORA && ahora - empieza < 6 * HORA
      );
    })
    .sort(
      (a, b) =>
        Math.abs(new Date(a.empieza).getTime() - ahora) -
        Math.abs(new Date(b.empieza).getTime() - ahora),
    )[0];
}

export type Posicion = { latitud: number; longitud: number } | null;

/**
 * Posición del móvil en este momento, o `null` si no hay permiso o no llega a tiempo.
 * Se pide una sola vez y no se guarda en ningún sitio: solo viaja dentro del mensaje.
 */
export async function obtenerPosicion(): Promise<Posicion> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return null;

    const reciente = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolver) => setTimeout(() => resolver(null), ESPERA_GPS)),
    ]);
    const posicion = reciente ?? (await Location.getLastKnownPositionAsync());
    if (!posicion) return null;
    return { latitud: posicion.coords.latitude, longitud: posicion.coords.longitude };
  } catch {
    return null;
  }
}

/** Texto que recibe el contacto de confianza. */
export function redactarAviso(posicion: Posicion, quedada: QuedadaCercana | undefined): string {
  const lineas = ['Necesito ayuda. Te escribo desde el aviso de emergencia de Planeo.'];
  if (posicion) {
    const coordenadas = `${posicion.latitud.toFixed(5)},${posicion.longitud.toFixed(5)}`;
    lineas.push(`Estoy aquí ahora: https://maps.google.com/?q=${coordenadas}`);
  } else {
    lineas.push('No he podido adjuntar mi ubicación.');
  }
  if (quedada) {
    const sitio = quedada.lugar_nombre ? ` en ${quedada.lugar_nombre}` : '';
    lineas.push(`Había quedado para «${quedada.titulo}»${sitio}.`);
  }
  return lineas.join('\n');
}

export function llamarEmergencias() {
  return Linking.openURL(`tel:${TELEFONO_EMERGENCIAS}`);
}

/** Abre la app de mensajes con el aviso ya escrito; falta solo pulsar enviar. */
export function abrirSms(telefono: string, texto: string) {
  const separador = Platform.OS === 'ios' ? '&' : '?';
  return Linking.openURL(`sms:${telefono}${separador}body=${encodeURIComponent(texto)}`);
}

/** Abre el chat de WhatsApp del contacto con el aviso ya escrito. */
export function abrirWhatsapp(telefono: string, texto: string) {
  return Linking.openURL(
    `https://wa.me/${telefono.replace('+', '')}?text=${encodeURIComponent(texto)}`,
  );
}
