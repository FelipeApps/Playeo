import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Boton } from '@/components/boton';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { FilaUsuario } from '@/components/fila-usuario';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import { mensajeDeError } from '@/lib/supabase';
import { useAccionesGrupo, useAmigosInvitables } from '@/social/grupos';
import { espacio, radio } from '@/theme';

export default function PantallaInvitarAGrupo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invitables = useAmigosInvitables(id);
  const { invitar } = useAccionesGrupo();

  let contenido;
  if (invitables.isPending) {
    contenido = <Esqueleto alto={74} redondeo={radio.l} />;
  } else if (invitables.isError) {
    contenido = (
      <EstadoVacio
        escena="sin-conexion"
        titulo="No se pudo cargar tu lista de amigos"
        mensaje="Comprueba que tienes conexión con el servidor y vuelve a intentarlo.">
        <Boton titulo="Reintentar" onPress={() => invitables.refetch()} />
      </EstadoVacio>
    );
  } else if (invitables.data.length === 0) {
    contenido = (
      <EstadoVacio
        escena="vacio"
        titulo="No queda nadie por invitar"
        mensaje="Todos tus amigos están ya en el grupo o tienen una invitación pendiente. Solo puedes invitar a tus amigos.">
        <Boton
          titulo="Buscar amigos"
          variante="secundario"
          onPress={() => router.push('/amigos')}
        />
      </EstadoVacio>
    );
  } else {
    contenido = (
      <View style={estilos.lista}>
        {invitables.data.map((amigo) => (
          <FilaUsuario key={amigo.id} usuario={amigo}>
            <Boton
              compacto
              titulo="Invitar"
              cargando={invitar.isPending && invitar.variables?.usuario === amigo.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                invitar.mutate({ grupo: id, usuario: amigo.id });
              }}
            />
          </FilaUsuario>
        ))}
      </View>
    );
  }

  return (
    <PantallaFormulario
      titulo="Invitar amigos"
      subtitulo="Recibirán una invitación que pueden aceptar o rechazar.">
      {invitar.isError ? (
        <Texto variante="detalle" color="error" accessibilityLiveRegion="polite">
          {mensajeDeError(invitar.error)}
        </Texto>
      ) : null}
      {contenido}
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.xs },
});
