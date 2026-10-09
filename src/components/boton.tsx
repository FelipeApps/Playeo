import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, type AccessibilityRole } from 'react-native';

import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { espacio, radio, TACTIL_MINIMO, useTema } from '@/theme';

interface Props {
  titulo: string;
  onPress: () => void;
  /** 'principal': píldora azul. 'secundario': contorno. 'peligro': acciones destructivas. */
  variante?: 'principal' | 'secundario' | 'peligro';
  /** Muestra un indicador y bloquea el botón mientras dura la operación. */
  cargando?: boolean;
  deshabilitado?: boolean;
  /** Versión baja y estrecha, para acciones dentro de una fila. */
  compacto?: boolean;
  /** Icono a la izquierda del texto. */
  children?: ReactNode;
  accessibilityRole?: AccessibilityRole;
  accessibilityHint?: string;
}

export function Boton({
  titulo,
  onPress,
  variante = 'principal',
  cargando = false,
  deshabilitado = false,
  compacto = false,
  children,
  accessibilityRole,
  accessibilityHint,
}: Props) {
  const { colores } = useTema();
  const inactivo = cargando || deshabilitado;
  const fondo = variante === 'principal' ? colores.primario : 'transparent';
  const tinta =
    variante === 'principal' ? 'sobrePrimario' : variante === 'peligro' ? 'error' : 'primario';

  return (
    <Presionable
      accessibilityRole={accessibilityRole}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      disabled={inactivo}
      onPress={onPress}
      style={[
        estilos.boton,
        compacto && estilos.compacto,
        {
          backgroundColor: fondo,
          borderColor: variante === 'principal' ? colores.primario : colores[tinta],
          opacity: deshabilitado ? 0.45 : 1,
        },
      ]}>
      {cargando ? <ActivityIndicator color={colores[tinta]} /> : children}
      <Texto variante={compacto ? 'etiqueta' : 'cuerpoFuerte'} color={tinta}>
        {titulo}
      </Texto>
    </Presionable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    gap: espacio.xs,
    minHeight: TACTIL_MINIMO + 4,
    paddingHorizontal: espacio.l,
    borderRadius: radio.completo,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compacto: { minHeight: 44, paddingHorizontal: espacio.m },
});
