import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Almacén de la sesión de Supabase, cifrado.
 *
 * La sesión no cabe en el almacén seguro del sistema (tiene un tope de unos 2 KB), así que
 * se guarda cifrada con AES-256 en AsyncStorage y solo la clave va al almacén seguro
 * (Keychain en iOS, Keystore en Android). Sin esa clave, lo que hay en disco no sirve.
 * Cada vez que se guarda se genera una clave nueva.
 *
 * En la web no hay almacén seguro: se usa el almacenamiento del navegador tal cual.
 */

const EN_WEB = Platform.OS === 'web';

async function cifrar(clave: string, valor: string): Promise<string> {
  const llave = Crypto.getRandomValues(new Uint8Array(32));
  const cifrador = new aesjs.ModeOfOperation.ctr(llave, new aesjs.Counter(1));
  const cifrado = cifrador.encrypt(aesjs.utils.utf8.toBytes(valor));
  await SecureStore.setItemAsync(clave, aesjs.utils.hex.fromBytes(llave));
  return aesjs.utils.hex.fromBytes(cifrado);
}

async function descifrar(clave: string, guardado: string): Promise<string | null> {
  const llave = await SecureStore.getItemAsync(clave);
  if (!llave) {
    // Sesión guardada sin cifrar por una versión anterior de la app: se cifra ahora para
    // no cerrar la sesión a nadie al actualizar.
    if (!guardado.startsWith('{')) return null;
    await AsyncStorage.setItem(clave, await cifrar(clave, guardado));
    return guardado;
  }
  const cifrador = new aesjs.ModeOfOperation.ctr(
    aesjs.utils.hex.toBytes(llave),
    new aesjs.Counter(1),
  );
  return aesjs.utils.utf8.fromBytes(cifrador.decrypt(aesjs.utils.hex.toBytes(guardado)));
}

export const almacenSesion = {
  async getItem(clave: string): Promise<string | null> {
    const guardado = await AsyncStorage.getItem(clave);
    if (guardado == null || EN_WEB) return guardado;
    try {
      return await descifrar(clave, guardado);
    } catch {
      // Clave o datos ilegibles (por ejemplo, tras restaurar una copia en otro móvil):
      // se empieza de cero en vez de dejar la app bloqueada.
      await AsyncStorage.removeItem(clave);
      return null;
    }
  },

  async setItem(clave: string, valor: string): Promise<void> {
    await AsyncStorage.setItem(clave, EN_WEB ? valor : await cifrar(clave, valor));
  },

  async removeItem(clave: string): Promise<void> {
    await AsyncStorage.removeItem(clave);
    if (!EN_WEB) await SecureStore.deleteItemAsync(clave);
  },
};
