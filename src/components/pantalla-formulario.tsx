import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CabeceraCielo } from '@/components/cabecera-cielo';
import { useBarraEstado } from '@/components/pantalla';
import { espacio, useTema } from '@/theme';

interface Props {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}

/** Pantalla apilada con cabecera de cielo y contenido que esquiva el teclado. */
export function PantallaFormulario({ titulo, subtitulo, children }: Props) {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  useBarraEstado('clara');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + espacio.xl }}>
        <CabeceraCielo titulo={titulo} subtitulo={subtitulo} conVolver />
        <View style={estilos.contenido}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { paddingHorizontal: espacio.l, gap: espacio.m },
});
