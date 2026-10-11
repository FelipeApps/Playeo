import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Boton } from '@/components/boton';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { useSesion } from '@/sesion/contexto';
import { momentoCorto } from '@/social/chat';
import {
  destinoDe,
  textoDe,
  useAccionesNotificaciones,
  useNotificaciones,
} from '@/social/notificaciones';
import { espacio, radio, useTema } from '@/theme';

export default function PantallaNotificaciones() {
  const { colores } = useTema();
  const { sesion } = useSesion();
  const notificaciones = useNotificaciones();
  const { marcarLeida, marcarTodas } = useAccionesNotificaciones();

  let contenido;
  if (!sesion) {
    contenido = (
      <EstadoVacio
        escena="vacio"
        titulo="Entra para ver tus avisos"
        mensaje="Aquí verás los mensajes nuevos, lo que pase en tus quedadas y las invitaciones.">
        <Boton titulo="Entrar" onPress={() => router.replace('/cuenta/entrar')} />
      </EstadoVacio>
    );
  } else if (notificaciones.isPending) {
    contenido = (
      <View style={estilos.lista}>
        <Esqueleto alto={74} redondeo={radio.l} />
        <Esqueleto alto={74} redondeo={radio.l} />
      </View>
    );
  } else if (notificaciones.isError) {
    contenido = (
      <EstadoVacio
        escena="sin-conexion"
        titulo="No se pudieron cargar tus avisos"
        mensaje="Comprueba que tienes conexión con el servidor y vuelve a intentarlo.">
        <Boton titulo="Reintentar" onPress={() => notificaciones.refetch()} />
      </EstadoVacio>
    );
  } else if (notificaciones.data.length === 0) {
    contenido = (
      <EstadoVacio
        escena="vacio"
        titulo="Todo tranquilo"
        mensaje="Cuando alguien te escriba, se apunte a tu quedada o te invite, lo verás aquí."
      />
    );
  } else {
    const sinLeer = notificaciones.data.some((notificacion) => !notificacion.leida);
    contenido = (
      <>
        {sinLeer ? (
          <Boton
            titulo="Marcar todo como leído"
            variante="secundario"
            cargando={marcarTodas.isPending}
            onPress={() => marcarTodas.mutate()}
          />
        ) : null}
        <View style={estilos.lista}>
          {notificaciones.data.map((notificacion) => {
            const nueva = !notificacion.leida;
            const frase = textoDe(notificacion);
            return (
              <Presionable
                key={notificacion.id}
                accessibilityLabel={`${nueva ? 'Sin leer. ' : ''}${frase} ${momentoCorto(notificacion.creada)}`}
                accessibilityHint="Abre lo relacionado con este aviso"
                onPress={() => {
                  if (nueva) marcarLeida.mutate(notificacion.id);
                  router.push(
                    destinoDe(notificacion.tipo, notificacion.datos, notificacion.actor_id),
                  );
                }}
                style={[
                  estilos.fila,
                  {
                    backgroundColor: nueva ? colores.arena : colores.superficie,
                    borderColor: colores.borde,
                  },
                ]}>
                <Avatar
                  ruta={notificacion.actor_foto}
                  nombre={notificacion.actor_nombre ?? '?'}
                  tamano={46}
                />
                <View style={estilos.textos}>
                  <Texto
                    variante={nueva ? 'cuerpoFuerte' : 'cuerpo'}
                    color={nueva ? 'sobreArena' : 'texto'}>
                    {frase}
                  </Texto>
                  {notificacion.tipo === 'mensaje_nuevo' && notificacion.datos.extracto ? (
                    <Texto
                      variante="detalle"
                      color={nueva ? 'sobreArena' : 'textoSecundario'}
                      numberOfLines={2}>
                      {notificacion.datos.extracto}
                    </Texto>
                  ) : null}
                  <Texto variante="etiqueta" color={nueva ? 'sobreArena' : 'textoSecundario'}>
                    {momentoCorto(notificacion.creada)}
                  </Texto>
                </View>
                {nueva ? (
                  <View style={[estilos.punto, { backgroundColor: colores.primario }]} />
                ) : null}
              </Presionable>
            );
          })}
        </View>
      </>
    );
  }

  return (
    <PantallaFormulario titulo="Avisos" subtitulo="Mensajes, quedadas, grupos y amistades.">
      {contenido}
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.xs },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    padding: espacio.s,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  textos: { flex: 1, gap: 2 },
  punto: { width: 10, height: 10, borderRadius: 5 },
});
