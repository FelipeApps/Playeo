import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import type { TarjetaUsuario } from '@/social/amigos';
import { espacio, radio, useTema } from '@/theme';

interface Props {
  usuario: TarjetaUsuario;
  /** Acciones a la derecha: aceptar, añadir, desbloquear... */
  children?: ReactNode;
  /** Falso para filas que no deben abrir la ficha, como la lista de bloqueados. */
  abreFicha?: boolean;
}

/** Una persona en una lista: foto, nombre y usuario. Al tocarla se abre su ficha. */
export function FilaUsuario({ usuario, children, abreFicha = true }: Props) {
  const { colores } = useTema();

  const identidad = (
    <>
      <Avatar ruta={usuario.ruta_foto} nombre={usuario.nombre_visible} tamano={48} />
      <View style={estilos.nombres}>
        <Texto variante="cuerpoFuerte" numberOfLines={1}>
          {usuario.nombre_visible}
        </Texto>
        <Texto variante="etiqueta" color="textoSecundario" numberOfLines={1}>
          @{usuario.nombre_usuario}
        </Texto>
      </View>
    </>
  );

  return (
    <View
      style={[estilos.fila, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      {/* El contenedor reparte el ancho; Presionable solo da estilo a su interior. */}
      <View style={estilos.hueco}>
        {abreFicha ? (
          <Presionable
            accessibilityLabel={`${usuario.nombre_visible}, arroba ${usuario.nombre_usuario}`}
            accessibilityHint="Abre su ficha"
            onPress={() => router.push({ pathname: '/usuario/[id]', params: { id: usuario.id } })}
            style={estilos.identidad}>
            {identidad}
          </Presionable>
        ) : (
          <View style={estilos.identidad}>{identidad}</View>
        )}
      </View>
      {children ? <View style={estilos.acciones}>{children}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    padding: espacio.s,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hueco: { flex: 1 },
  identidad: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, minHeight: 48 },
  nombres: { flexShrink: 1, gap: 1 },
  acciones: { flexDirection: 'row', gap: espacio.xs },
});
