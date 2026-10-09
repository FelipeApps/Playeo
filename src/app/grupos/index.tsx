import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Boton } from '@/components/boton';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { useSesion } from '@/sesion/contexto';
import { useAccionesGrupo, useInvitacionesGrupo, useMisGrupos } from '@/social/grupos';
import { espacio, radio, sombra, useTema } from '@/theme';

function cuantos(miembros: number) {
  return miembros === 1 ? '1 miembro' : `${miembros} miembros`;
}

export default function PantallaGrupos() {
  const { colores, esOscuro } = useTema();
  const { sesion } = useSesion();
  const grupos = useMisGrupos();
  const invitaciones = useInvitacionesGrupo();
  const { aceptarInvitacion, rechazarInvitacion } = useAccionesGrupo();
  const marco = { backgroundColor: colores.superficie, borderColor: colores.borde };

  if (!sesion) {
    return (
      <PantallaFormulario titulo="Grupos">
        <EstadoVacio
          escena="vacio"
          titulo="Entra para ver tus grupos"
          mensaje="Necesitas una cuenta para crear grupos y unirte a los de tus amigos.">
          <Boton titulo="Entrar" onPress={() => router.replace('/cuenta/entrar')} />
        </EstadoVacio>
      </PantallaFormulario>
    );
  }

  let lista;
  if (grupos.isPending) {
    lista = <Esqueleto alto={88} redondeo={radio.l} />;
  } else if (grupos.isError) {
    lista = (
      <EstadoVacio
        escena="sin-conexion"
        titulo="No se pudieron cargar tus grupos"
        mensaje="Comprueba que tienes conexión con el servidor y vuelve a intentarlo.">
        <Boton titulo="Reintentar" onPress={() => grupos.refetch()} />
      </EstadoVacio>
    );
  } else if (grupos.data.length === 0) {
    lista = (
      <EstadoVacio
        escena="vacio"
        titulo="Aún no estás en ningún grupo"
        mensaje="Crea uno para tu gente de siempre: los del surf, la familia, los del trabajo."
      />
    );
  } else {
    lista = grupos.data.map((grupo) => (
      <Presionable
        key={grupo.id}
        accessibilityLabel={`${grupo.nombre}, ${cuantos(grupo.miembros)}`}
        accessibilityHint="Abre el grupo"
        onPress={() => router.push({ pathname: '/grupos/[id]', params: { id: grupo.id } })}
        style={[estilos.tarjeta, sombra(esOscuro), marco]}>
        <View style={[estilos.inicial, { backgroundColor: colores.arena }]}>
          <Texto variante="titulo" color="sobreArena">
            {grupo.nombre.charAt(0).toUpperCase()}
          </Texto>
        </View>
        <View style={estilos.textos}>
          <Texto variante="subtitulo" numberOfLines={1}>
            {grupo.nombre}
          </Texto>
          <Texto variante="etiqueta" color="textoSecundario">
            {cuantos(grupo.miembros)}
            {grupo.mi_rol === 'admin' ? ', lo administras' : ''}
          </Texto>
        </View>
        <Feather name="chevron-right" size={22} color={colores.textoSecundario} />
      </Presionable>
    ));
  }

  return (
    <PantallaFormulario titulo="Grupos" subtitulo="Tu gente de siempre, a mano.">
      {invitaciones.data && invitaciones.data.length > 0 ? (
        <View style={estilos.bloque}>
          <Texto variante="subtitulo" accessibilityRole="header">
            Te han invitado
          </Texto>
          {invitaciones.data.map((invitacion) => (
            <View
              key={invitacion.grupo_id}
              style={[estilos.invitacion, { backgroundColor: colores.arena }]}>
              <View style={estilos.textos}>
                <Texto variante="subtitulo" color="sobreArena">
                  {invitacion.grupo_nombre}
                </Texto>
                <Texto variante="detalle" color="sobreArena">
                  Te invita {invitacion.invitador_nombre}.
                </Texto>
              </View>
              <View style={estilos.acciones}>
                <Boton
                  compacto
                  titulo="Rechazar"
                  variante="secundario"
                  onPress={() => rechazarInvitacion.mutate(invitacion.grupo_id)}
                />
                <Boton
                  compacto
                  titulo="Unirme"
                  cargando={
                    aceptarInvitacion.isPending &&
                    aceptarInvitacion.variables === invitacion.grupo_id
                  }
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    aceptarInvitacion.mutate(invitacion.grupo_id);
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={estilos.bloque}>{lista}</View>
      <Boton titulo="Crear un grupo" onPress={() => router.push('/grupos/nuevo')} />
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.xs },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    padding: espacio.s,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inicial: {
    width: 52,
    height: 52,
    borderRadius: radio.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, gap: 2 },
  invitacion: { padding: espacio.m, gap: espacio.s, borderRadius: radio.l },
  acciones: { flexDirection: 'row', gap: espacio.xs, justifyContent: 'flex-end' },
});
