import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Boton } from '@/components/boton';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import { buscarZona } from '@/data/zonas';
import { mensajeDeError } from '@/lib/supabase';
import { useAccionesSociales, useUsuario } from '@/social/amigos';
import { abrirConversacionDirecta } from '@/social/chat';
import { espacio, radio, sombra, useTema } from '@/theme';

export default function PantallaUsuario() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colores, esOscuro } = useTema();
  const { data: usuario, isPending, isError } = useUsuario(id);
  const { solicitar, aceptar, eliminar, bloquear, desbloquear } = useAccionesSociales();

  if (isPending) {
    return (
      <PantallaFormulario titulo="Perfil">
        <Esqueleto alto={220} redondeo={radio.xl} />
      </PantallaFormulario>
    );
  }

  // Sin datos: no existe, o esa persona me ha bloqueado. A propósito, no se distingue.
  if (isError || !usuario) {
    return (
      <PantallaFormulario titulo="Perfil">
        <EstadoVacio
          escena="extravio"
          titulo="No encontramos a esta persona"
          mensaje="Puede que haya borrado su cuenta o que su perfil no esté disponible.">
          <Boton titulo="Volver" onPress={() => router.back()} />
        </EstadoVacio>
      </PantallaFormulario>
    );
  }

  const avisar = (fallo: unknown) => Alert.alert('No se pudo completar', mensajeDeError(fallo));
  const zona = buscarZona(usuario.zona);

  const confirmarBloqueo = () => {
    Alert.alert(
      `Bloquear a ${usuario.nombre_visible}`,
      'No podrá ver tu perfil, escribirte, invitarte ni ver tus quedadas. Dejaréis de ser amigos y no se le avisará.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: () =>
            bloquear.mutate(usuario.id, {
              onError: avisar,
              onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
            }),
        },
      ],
    );
  };

  const confirmarEliminar = () => {
    Alert.alert(`Eliminar a ${usuario.nombre_visible} de tus amigos`, 'No se le avisará.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => eliminar.mutate(usuario.id, { onError: avisar }),
      },
    ]);
  };

  let accion;
  switch (usuario.relacion) {
    case 'ninguna':
      accion = (
        <Boton
          titulo="Añadir a mis amigos"
          cargando={solicitar.isPending}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            solicitar.mutate(usuario.id, { onError: avisar });
          }}
        />
      );
      break;
    case 'solicitud_enviada':
      accion = (
        <Boton
          titulo="Cancelar solicitud"
          variante="secundario"
          cargando={eliminar.isPending}
          onPress={() => eliminar.mutate(usuario.id, { onError: avisar })}
        />
      );
      break;
    case 'solicitud_recibida':
      accion = (
        <>
          <Boton
            titulo="Aceptar solicitud"
            cargando={aceptar.isPending}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              aceptar.mutate(usuario.id, { onError: avisar });
            }}
          />
          <Boton
            titulo="Rechazar"
            variante="secundario"
            onPress={() => eliminar.mutate(usuario.id, { onError: avisar })}
          />
        </>
      );
      break;
    case 'amigo':
      accion = (
        <>
          <Boton
            titulo="Enviar mensaje"
            onPress={async () => {
              try {
                const conversacion = await abrirConversacionDirecta(usuario.id);
                router.push({
                  pathname: '/chat/[id]',
                  params: { id: conversacion, titulo: usuario.nombre_visible },
                });
              } catch (fallo) {
                avisar(fallo);
              }
            }}
          />
          <Boton
            titulo="Eliminar de mis amigos"
            variante="secundario"
            onPress={confirmarEliminar}
          />
        </>
      );
      break;
    case 'bloqueado':
      accion = (
        <Boton
          titulo="Desbloquear"
          variante="secundario"
          cargando={desbloquear.isPending}
          onPress={() => desbloquear.mutate(usuario.id, { onError: avisar })}
        />
      );
      break;
    default:
      accion = (
        <Boton
          titulo="Editar mi perfil"
          variante="secundario"
          onPress={() => router.push('/cuenta/editar')}
        />
      );
  }

  const esOtraPersona = usuario.relacion !== 'yo';

  return (
    <PantallaFormulario titulo={usuario.nombre_visible} subtitulo={`@${usuario.nombre_usuario}`}>
      <View
        style={[
          estilos.ficha,
          sombra(esOscuro),
          { backgroundColor: colores.superficie, borderColor: colores.borde },
        ]}>
        <View style={estilos.identidad}>
          <Avatar ruta={usuario.ruta_foto} nombre={usuario.nombre_visible} tamano={84} />
          <View style={estilos.datos}>
            {usuario.relacion === 'amigo' ? (
              <View style={[estilos.sello, { backgroundColor: colores.arena }]}>
                <Texto variante="etiqueta" color="sobreArena">
                  Sois amigos
                </Texto>
              </View>
            ) : null}
            {zona ? <Texto variante="cuerpoFuerte">{zona.nombre}</Texto> : null}
          </View>
        </View>

        {usuario.relacion === 'bloqueado' ? (
          <Texto color="textoSecundario">
            Has bloqueado a esta persona. No puede ver tu perfil ni escribirte.
          </Texto>
        ) : usuario.perfil_visible ? (
          <Texto color={usuario.bio ? 'texto' : 'textoSecundario'}>
            {usuario.bio ?? 'Aún no ha escrito nada sobre sí.'}
          </Texto>
        ) : (
          <Texto color="textoSecundario">
            Este perfil es solo para amigos. Envíale una solicitud para ver más.
          </Texto>
        )}

        {accion}
      </View>

      {esOtraPersona ? (
        <View style={estilos.seguridad}>
          {usuario.relacion === 'bloqueado' ? null : (
            <Boton
              titulo="Bloquear"
              variante="peligro"
              cargando={bloquear.isPending}
              onPress={confirmarBloqueo}
            />
          )}
          <Boton
            titulo="Reportar"
            variante="peligro"
            onPress={() =>
              router.push({
                pathname: '/reportar',
                params: { usuario: usuario.id, nombre: usuario.nombre_visible },
              })
            }
          />
        </View>
      ) : null}
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  ficha: {
    padding: espacio.m,
    gap: espacio.m,
    borderRadius: radio.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  identidad: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  datos: { flex: 1, gap: espacio.xs, alignItems: 'flex-start' },
  sello: { paddingHorizontal: espacio.s, paddingVertical: 4, borderRadius: radio.completo },
  seguridad: { gap: espacio.s, paddingTop: espacio.m },
});
