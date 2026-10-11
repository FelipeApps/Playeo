import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { VERSION_CONDICIONES } from '@/data/textos-legales';
import { ProveedorPreferencias } from '@/preferencias/contexto';
import { ProveedorRegion } from '@/region/contexto';
import { ProveedorSesion, useMiPerfil, useSesion } from '@/sesion/contexto';
import {
  registrarDispositivo,
  useAbrirDesdePush,
  useEscucharNotificaciones,
} from '@/social/notificaciones';
import { fuentes, useTema } from '@/theme';

SplashScreen.preventAutoHideAsync();

const MINUTO = 60 * 1000;
/** Durante este tiempo los datos se dan por buenos y no se vuelve a pedir nada. */
const VIGENCIA = 30 * MINUTO;
/** Tiempo que se conserva la última descarga en disco, para abrir la app sin conexión. */
const CONSERVACION = 24 * 60 * MINUTO;

const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: { staleTime: VIGENCIA, gcTime: CONSERVACION, retry: 1 },
  },
});

const persistencia = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'planeo/consultas',
});

/**
 * Vida social en segundo plano mientras la app está abierta: avisos en vivo, apertura
 * desde una push y registro del dispositivo si el permiso ya estaba concedido.
 */
function EscuchaSocial() {
  const { sesion } = useSesion();
  const idUsuario = sesion?.user.id;
  useEscucharNotificaciones();
  useAbrirDesdePush();

  // Una cuenta que entró con Google o Apple aún no ha confirmado la mayoría de edad:
  // se le pide antes de que use nada social.
  const { data: perfil } = useMiPerfil();
  const ruta = usePathname();
  // Tampoco ha aceptado las condiciones, o las aceptó en una versión anterior.
  const pendiente =
    perfil != null &&
    (perfil.mayoria_edad_confirmada == null || // Un servidor aún sin esta columna no la devuelve: ahí no se puede pedir.
      ('condiciones_version' in perfil && perfil.condiciones_version !== VERSION_CONDICIONES));
  useEffect(() => {
    if (pendiente && ruta !== '/cuenta/edad' && ruta !== '/cuenta/condiciones') {
      router.replace('/cuenta/edad');
    }
  }, [pendiente, ruta]);

  useEffect(() => {
    // Sin diálogo: solo registra si el usuario ya dio permiso en su momento.
    if (idUsuario) registrarDispositivo(false).catch(() => {});
  }, [idUsuario]);

  return null;
}

export default function LayoutRaiz() {
  const { colores, esOscuro } = useTema();
  const [fuentesListas, errorFuentes] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
  });

  // Si las fuentes fallan seguimos con la del sistema antes que dejar la app en blanco.
  const listo = fuentesListas || errorFuentes != null;

  useEffect(() => {
    if (listo) SplashScreen.hideAsync();
  }, [listo]);

  if (!listo) return null;

  const base = esOscuro ? DarkTheme : DefaultTheme;
  const temaNavegacion = {
    ...base,
    colors: {
      ...base.colors,
      background: colores.fondo,
      card: colores.fondo,
      text: colores.texto,
      border: colores.borde,
      primary: colores.primario,
    },
  };

  return (
    <GestureHandlerRootView style={estilos.raiz}>
      <PersistQueryClientProvider
        client={clienteConsultas}
        persistOptions={{
          persister: persistencia,
          maxAge: CONSERVACION,
          // Los datos sociales (perfil, chats) no se guardan en disco: solo el tiempo y el mar.
          dehydrateOptions: {
            shouldDehydrateQuery: (consulta) =>
              consulta.state.status === 'success' && consulta.queryKey[0] !== 'social',
          },
        }}>
        <ProveedorRegion>
          <ProveedorPreferencias>
            <ProveedorSesion>
              <EscuchaSocial />
              <ThemeProvider value={temaNavegacion}>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    headerTitleStyle: { fontFamily: fuentes.titulo },
                    contentStyle: { backgroundColor: colores.fondo },
                  }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="bienvenida" />
                  <Stack.Screen name="zona" />
                  <Stack.Screen name="playa/[id]" />
                  <Stack.Screen name="lugar/[id]" />
                  <Stack.Screen name="cuenta/entrar" />
                  <Stack.Screen name="cuenta/registro" />
                  <Stack.Screen name="cuenta/verificar" />
                  <Stack.Screen name="cuenta/editar" />
                  <Stack.Screen name="amigos" />
                  <Stack.Screen name="usuario/[id]" />
                  <Stack.Screen name="bloqueados" />
                  <Stack.Screen name="reportar" />
                  <Stack.Screen name="grupos/index" />
                  <Stack.Screen name="grupos/nuevo" />
                  <Stack.Screen name="grupos/[id]/index" />
                  <Stack.Screen name="grupos/[id]/invitar" />
                  <Stack.Screen name="grupos/[id]/editar" />
                  <Stack.Screen name="chat/[id]" />
                  <Stack.Screen name="evento/nuevo" />
                  <Stack.Screen name="evento/[id]/index" />
                  <Stack.Screen name="evento/[id]/invitar" />
                  <Stack.Screen name="notificaciones" />
                  <Stack.Screen name="cuenta/recuperar" />
                  <Stack.Screen name="cuenta/edad" />
                  <Stack.Screen name="cuenta/condiciones" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="evento/[id]/editar" />
                  <Stack.Screen name="moderacion" />
                  <Stack.Screen name="emergencia" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="contacto-confianza" />
                </Stack>
              </ThemeProvider>
            </ProveedorSesion>
          </ProveedorPreferencias>
        </ProveedorRegion>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
});
