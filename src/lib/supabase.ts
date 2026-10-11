import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { almacenSesion } from '@/lib/almacen-sesion';
import type { Database } from '@/lib/database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const claveAnonima = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Falso si falta .env.local. La app sigue funcionando (Hoy y Mapa no dependen del
 * backend); solo las funciones sociales avisan de que no están disponibles.
 */
export const supabaseConfigurado = Boolean(url && claveAnonima);

export const URL_SUPABASE = url ?? '';
export const CLAVE_ANONIMA = claveAnonima ?? '';

export const supabase = createClient<Database>(
  url ?? 'http://sin-configurar.invalid',
  claveAnonima ?? 'sin-configurar',
  {
    auth: {
      // La sesión se guarda cifrada; la clave vive en el almacén seguro del sistema.
      storage: almacenSesion,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// El token solo se renueva con la app en primer plano.
if (supabaseConfigurado) {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export type Perfil = Database['public']['Tables']['perfiles']['Row'];
export type CambiosPerfil = Database['public']['Tables']['perfiles']['Update'];
export type Privacidad = Database['public']['Enums']['privacidad_perfil'];

/** Traduce los errores de Supabase a algo que el usuario pueda entender y resolver. */
export function mensajeDeError(error: unknown): string {
  const texto =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : '';
  const codigo =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  // En desarrollo, el error original va a la consola: el mensaje traducido no basta para depurar.
  if (__DEV__) console.warn('[supabase]', codigo || 'sin código', texto || error);

  if (codigo === 'PT429' || /Demasiadas acciones seguidas/.test(texto)) {
    return 'Vas demasiado rápido. Espera un momento y vuelve a intentarlo.';
  }
  if (/aceptar los Términos de uso/.test(texto)) {
    return 'Antes tienes que leer y aceptar los Términos de uso.';
  }
  if (/error sending .*email/i.test(texto)) {
    return 'No se ha podido enviar el correo con el código. Inténtalo de nuevo en unos minutos.';
  }
  if (/network request failed|failed to fetch/i.test(texto)) {
    return 'No hay conexión con el servidor. Comprueba tu conexión a internet.';
  }
  if (codigo === 'invalid_credentials' || /invalid login credentials/i.test(texto)) {
    return 'El correo o la contraseña no coinciden.';
  }
  if (codigo === 'user_already_exists' || /already registered/i.test(texto)) {
    return 'Ya hay una cuenta con ese correo. Prueba a entrar.';
  }
  if (codigo === 'otp_expired' || /token has expired or is invalid/i.test(texto)) {
    return 'El código no es correcto o ha caducado. Pide uno nuevo.';
  }
  if (codigo === 'weak_password' || /password should be/i.test(texto)) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (codigo === 'over_email_send_rate_limit' || /rate limit/i.test(texto)) {
    return 'Has pedido demasiados correos seguidos. Espera un minuto y vuelve a intentarlo.';
  }
  if (/perfiles_nombre_usuario_key|Database error saving new user/i.test(texto)) {
    return 'Ese nombre de usuario ya está cogido. Elige otro.';
  }
  if (/El evento está completo/.test(texto)) {
    return 'La quedada está completa. Puedes marcar «Quizá» por si queda una plaza.';
  }
  if (/invitaciones_evento_pkey/.test(texto)) {
    return 'Esa persona ya tiene una invitación a esta quedada.';
  }
  if (/confirmar la mayoría de edad|Solo con la mayoría de edad/.test(texto)) {
    return 'Antes tienes que confirmar que eres mayor de edad.';
  }
  if (/necesita al menos un administrador/.test(texto)) {
    return 'El grupo necesita al menos un administrador. Nombra a otra persona antes.';
  }
  if (/invitaciones_grupo_pkey/.test(texto)) {
    return 'Esa persona ya tiene una invitación a este grupo.';
  }
  if (/Sin permiso para quitar/.test(texto)) {
    return 'No tienes permiso para quitar a este miembro.';
  }
  if (/nombre_usuario_formato/.test(texto)) {
    return 'El nombre de usuario solo admite letras, números, punto y guion bajo (de 3 a 24).';
  }
  return 'Algo ha fallado. Vuelve a intentarlo en un momento.';
}
