import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const CLAVE = 'planeo/contacto-confianza';

/** Persona a la que se avisa desde la pantalla de emergencia. */
export interface ContactoConfianza {
  nombre: string;
  /** Teléfono en formato internacional, con el «+» delante y sin espacios. */
  telefono: string;
}

// El contacto vive solo en este móvil: es el teléfono de otra persona y no tiene por qué
// salir de aquí. `undefined` mientras no se ha leído; `null` cuando no hay ninguno.
let actual: ContactoConfianza | null | undefined;
const oyentes = new Set<() => void>();

function publicar(nuevo: ContactoConfianza | null) {
  actual = nuevo;
  oyentes.forEach((avisar) => avisar());
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  if (actual === undefined && oyentes.size === 1) {
    AsyncStorage.getItem(CLAVE)
      .then((guardado) => publicar(guardado ? JSON.parse(guardado) : null))
      .catch(() => publicar(null));
  }
  return () => {
    oyentes.delete(avisar);
  };
}

/**
 * Deja un teléfono en formato internacional. Sin prefijo se entiende que es español.
 * Devuelve `null` si no parece un teléfono.
 */
export function normalizarTelefono(texto: string): string | null {
  const limpio = texto.replace(/[\s().-]/g, '');
  const conPrefijo = limpio.startsWith('00') ? `+${limpio.slice(2)}` : limpio;
  if (/^\+\d{8,15}$/.test(conPrefijo)) return conPrefijo;
  if (/^\d{9}$/.test(conPrefijo)) return `+34${conPrefijo}`;
  return null;
}

/** Contacto de confianza guardado en el dispositivo, y cómo cambiarlo o quitarlo. */
export function useContactoConfianza() {
  const contacto = useSyncExternalStore(
    suscribir,
    () => actual,
    () => undefined,
  );

  const guardar = (nuevo: ContactoConfianza) => {
    publicar(nuevo);
    AsyncStorage.setItem(CLAVE, JSON.stringify(nuevo)).catch(() => {});
  };

  const quitar = () => {
    publicar(null);
    AsyncStorage.removeItem(CLAVE).catch(() => {});
  };

  return { contacto: contacto ?? null, listo: contacto !== undefined, guardar, quitar };
}
