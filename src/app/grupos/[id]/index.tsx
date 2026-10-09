import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { Boton } from '@/components/boton';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { FilaUsuario } from '@/components/fila-usuario';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import { mensajeDeError } from '@/lib/supabase';
import { useSesion } from '@/sesion/contexto';
import { conversacionDeGrupo } from '@/social/chat';
import { useAccionesGrupo, useMiembrosGrupo, useMisGrupos } from '@/social/grupos';
import { espacio, radio, useTema } from '@/theme';

export default function PantallaGrupo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colores } = useTema();
  const { sesion } = useSesion();
  const grupos = useMisGrupos();
  const miembros = useMiembrosGrupo(id);
  const { quitarMiembro, cambiarRol, eliminar } = useAccionesGrupo();

  const grupo = grupos.data?.find((candidato) => candidato.id === id);
  const yo = sesion?.user.id;

  if (grupos.isPending) {
    return (
      <PantallaFormulario titulo="Grupo">
        <Esqueleto alto={200} redondeo={radio.l} />
      </PantallaFormulario>
    );
  }

  // No está entre mis grupos: no existe, me han expulsado o he salido.
  if (!grupo || !yo) {
    return (
      <PantallaFormulario titulo="Grupo">
        <EstadoVacio
          escena="extravio"
          titulo="No formas parte de este grupo"
          mensaje="Puede que se haya eliminado o que ya no seas miembro.">
          <Boton titulo="Volver" onPress={() => router.back()} />
        </EstadoVacio>
      </PantallaFormulario>
    );
  }

  const soyAdmin = grupo.mi_rol === 'admin';
  const avisar = (fallo: unknown) => Alert.alert('No se pudo completar', mensajeDeError(fallo));

  const confirmar = (titulo: string, mensaje: string, accion: string, alConfirmar: () => void) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: accion, style: 'destructive', onPress: alConfirmar },
    ]);
  };

  const salir = () =>
    confirmar(
      `Salir de ${grupo.nombre}`,
      grupo.miembros === 1
        ? 'Eres la única persona del grupo: al salir, se eliminará.'
        : 'Dejarás de ver el grupo. Para volver tendrán que invitarte de nuevo.',
      'Salir',
      () =>
        quitarMiembro.mutate(
          { grupo: id, usuario: yo },
          { onError: avisar, onSuccess: () => router.back() },
        ),
    );

  const eliminarGrupo = () =>
    confirmar(
      `Eliminar ${grupo.nombre}`,
      'Se eliminará para todos sus miembros. No se puede deshacer.',
      'Eliminar grupo',
      () => eliminar.mutate(id, { onError: avisar, onSuccess: () => router.back() }),
    );

  /** Acciones de administración sobre otro miembro, en un menú. */
  const gestionar = (miembro: { id: string; nombre_visible: string; rol: 'admin' | 'miembro' }) => {
    Alert.alert(miembro.nombre_visible, undefined, [
      {
        text: miembro.rol === 'admin' ? 'Quitar como administrador' : 'Hacer administrador',
        onPress: () =>
          cambiarRol.mutate(
            { grupo: id, usuario: miembro.id, rol: miembro.rol === 'admin' ? 'miembro' : 'admin' },
            { onError: avisar },
          ),
      },
      {
        text: 'Expulsar del grupo',
        style: 'destructive',
        onPress: () =>
          quitarMiembro.mutate({ grupo: id, usuario: miembro.id }, { onError: avisar }),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <PantallaFormulario
      titulo={grupo.nombre}
      subtitulo={grupo.miembros === 1 ? '1 miembro' : `${grupo.miembros} miembros`}>
      {grupo.descripcion ? <Texto>{grupo.descripcion}</Texto> : null}

      <View style={estilos.bloque}>
        <Boton
          titulo="Abrir el chat del grupo"
          onPress={async () => {
            try {
              const conversacion = await conversacionDeGrupo(id);
              router.push({
                pathname: '/chat/[id]',
                params: { id: conversacion, titulo: grupo.nombre },
              });
            } catch (fallo) {
              avisar(fallo);
            }
          }}
        />
        {grupo.enlace_whatsapp ? (
          <Boton
            titulo="Unirme al grupo de WhatsApp"
            variante="secundario"
            accessibilityRole="link"
            accessibilityHint="Abre WhatsApp con la invitación al grupo"
            onPress={() => {
              if (grupo.enlace_whatsapp) Linking.openURL(grupo.enlace_whatsapp).catch(avisar);
            }}
          />
        ) : null}
        <Boton
          titulo="Invitar amigos"
          variante="secundario"
          onPress={() => router.push({ pathname: '/grupos/[id]/invitar', params: { id } })}
        />
        {soyAdmin ? (
          <Boton
            titulo={grupo.enlace_whatsapp ? 'Editar el grupo' : 'Editar y añadir WhatsApp'}
            variante="secundario"
            onPress={() => router.push({ pathname: '/grupos/[id]/editar', params: { id } })}
          />
        ) : null}
      </View>

      <View style={estilos.bloque}>
        <Texto variante="subtitulo" accessibilityRole="header">
          Miembros
        </Texto>
        {miembros.isPending ? (
          <Esqueleto alto={74} redondeo={radio.l} />
        ) : miembros.isError ? (
          <Texto color="textoSecundario">No se pudo cargar la lista de miembros.</Texto>
        ) : (
          miembros.data.map((miembro) => (
            <FilaUsuario key={miembro.id} usuario={miembro}>
              {miembro.rol === 'admin' ? (
                <View style={[estilos.sello, { backgroundColor: colores.arena }]}>
                  <Texto variante="etiqueta" color="sobreArena">
                    Admin
                  </Texto>
                </View>
              ) : null}
              {soyAdmin && miembro.id !== yo ? (
                <Boton
                  compacto
                  titulo="Gestionar"
                  variante="secundario"
                  onPress={() => gestionar(miembro)}
                />
              ) : null}
            </FilaUsuario>
          ))
        )}
      </View>

      <View style={estilos.bloque}>
        <Boton
          titulo="Salir del grupo"
          variante="peligro"
          onPress={salir}
          cargando={quitarMiembro.isPending}
        />
        {soyAdmin ? (
          <Boton
            titulo="Eliminar el grupo"
            variante="peligro"
            onPress={eliminarGrupo}
            cargando={eliminar.isPending}
          />
        ) : null}
      </View>
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.xs },
  sello: {
    alignSelf: 'center',
    paddingHorizontal: espacio.s,
    paddingVertical: 4,
    borderRadius: radio.completo,
  },
});
