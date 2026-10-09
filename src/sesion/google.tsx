import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';

import { Boton } from '@/components/boton';
import { Texto } from '@/components/texto';
import { mensajeDeError, supabase } from '@/lib/supabase';

const CLIENTE_WEB = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const CLIENTE_IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/**
 * El inicio de sesión con Google usa código nativo que Expo Go no incluye, así que
 * solo está disponible en una build propia y con el ID de cliente configurado.
 */
export const googleDisponible =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && Boolean(CLIENTE_WEB);

/** Devuelve `false` si el usuario cerró la ventana de Google sin elegir cuenta. */
async function entrarConGoogle(): Promise<boolean> {
  // Carga perezosa: en Expo Go la librería ni se evalúa.
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: CLIENTE_WEB, iosClientId: CLIENTE_IOS || undefined });
  await GoogleSignin.hasPlayServices();

  const respuesta = await GoogleSignin.signIn();
  const token = respuesta.data?.idToken;
  if (!token) return false;

  // Google entrega un token de identidad y Supabase lo valida: no hay redirecciones.
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
  if (error) throw error;
  return true;
}

/** Botón "Continuar con Google". No se muestra donde no puede funcionar. */
export function BotonGoogle() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string>();

  if (!googleDisponible) return null;

  const continuar = async () => {
    setError(undefined);
    setCargando(true);
    try {
      // Si la cuenta es nueva, la raíz de la app pedirá confirmar la mayoría de edad.
      if (await entrarConGoogle()) router.dismissTo('/perfil');
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <Boton
        titulo="Continuar con Google"
        variante="secundario"
        onPress={continuar}
        cargando={cargando}
      />
      {error ? (
        <Texto variante="detalle" color="error" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : null}
    </>
  );
}
