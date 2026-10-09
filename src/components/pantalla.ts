import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espacio, useTema } from '@/theme';

/** Alto aproximado de la barra de pestañas nativa, que flota sobre el contenido. */
export const ALTO_PESTANAS = Platform.select({ ios: 50, android: 80 }) ?? 0;

/** Márgenes para el contenido con scroll de una pestaña: libra la barra de estado y las pestañas. */
export function useMargenesPestana() {
  const insets = useSafeAreaInsets();
  return {
    paddingTop: insets.top + espacio.m,
    paddingBottom: insets.bottom + ALTO_PESTANAS + espacio.l,
    paddingLeft: insets.left + espacio.m,
    paddingRight: insets.right + espacio.m,
  };
}

/**
 * Fija el color de los iconos de la barra de estado mientras la pantalla tiene el foco.
 * 'clara' para pantallas con cabecera oscura (cielo); 'tema' sigue el modo claro/oscuro.
 */
export function useBarraEstado(modo: 'clara' | 'tema') {
  const { esOscuro } = useTema();
  const estilo = modo === 'clara' || esOscuro ? 'light' : 'dark';

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(estilo, true);
    }, [estilo]),
  );
}
