import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Boton } from '@/components/boton';
import { CabeceraCielo } from '@/components/cabecera-cielo';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { ALTO_PESTANAS, useBarraEstado } from '@/components/pantalla';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { useSesion } from '@/sesion/contexto';
import { momentoCorto, useConversaciones } from '@/social/chat';
import { espacio, fuentes, radio, sombra, useTema } from '@/theme';

export default function PantallaChats() {
  const { colores, esOscuro } = useTema();
  const insets = useSafeAreaInsets();
  const { sesion, lista } = useSesion();
  const conversaciones = useConversaciones();
  useBarraEstado('clara');

  let contenido;
  if (!lista) {
    contenido = <Esqueleto alto={84} redondeo={radio.l} />;
  } else if (!sesion) {
    contenido = (
      <EstadoVacio
        escena="vacio"
        titulo="Entra para chatear"
        mensaje="Con una cuenta podrás escribir a tus amigos y a tus grupos para organizar la playa.">
        <Boton titulo="Entrar" onPress={() => router.push('/cuenta/entrar')} />
      </EstadoVacio>
    );
  } else if (conversaciones.isPending) {
    contenido = (
      <>
        <Esqueleto alto={84} redondeo={radio.l} />
        <Esqueleto alto={84} redondeo={radio.l} />
      </>
    );
  } else if (conversaciones.isError) {
    contenido = (
      <EstadoVacio
        escena="sin-conexion"
        titulo="No se pudieron cargar tus chats"
        mensaje="Comprueba que tienes conexión con el servidor y vuelve a intentarlo.">
        <Boton titulo="Reintentar" onPress={() => conversaciones.refetch()} />
      </EstadoVacio>
    );
  } else if (conversaciones.data.length === 0) {
    contenido = (
      <EstadoVacio
        escena="vacio"
        titulo="Aún no tienes chats"
        mensaje="Escribe a un amigo desde su ficha o crea un grupo: cada grupo tiene su chat.">
        <Boton titulo="Ver mis amigos" onPress={() => router.push('/amigos')} />
        <Boton
          titulo="Ver mis grupos"
          variante="secundario"
          onPress={() => router.push('/grupos')}
        />
      </EstadoVacio>
    );
  } else {
    contenido = conversaciones.data.map((chat) => {
      const sinLeer = chat.no_leidos > 0;
      const previa = chat.ultimo_cuerpo
        ? `${chat.ultimo_mio ? 'Tú: ' : ''}${chat.ultimo_cuerpo}`
        : 'Aún no hay mensajes';
      return (
        <Presionable
          key={chat.id}
          accessibilityLabel={`${chat.titulo}. ${sinLeer ? `${chat.no_leidos} sin leer. ` : ''}${previa}`}
          accessibilityHint="Abre el chat"
          onPress={() =>
            router.push({ pathname: '/chat/[id]', params: { id: chat.id, titulo: chat.titulo } })
          }
          style={[
            estilos.fila,
            sombra(esOscuro),
            { backgroundColor: colores.superficie, borderColor: colores.borde },
          ]}>
          {chat.tipo === 'directa' ? (
            <Avatar ruta={chat.ruta_foto} nombre={chat.titulo} tamano={52} />
          ) : (
            <View style={[estilos.inicial, { backgroundColor: colores.arena }]}>
              <Texto variante="titulo" color="sobreArena">
                {chat.titulo.charAt(0).toUpperCase()}
              </Texto>
            </View>
          )}
          <View style={estilos.textos}>
            <View style={estilos.linea}>
              <Texto variante="cuerpoFuerte" numberOfLines={1} style={estilos.flexible}>
                {chat.titulo}
              </Texto>
              {chat.ultimo_mensaje ? (
                <Texto variante="etiqueta" color={sinLeer ? 'primario' : 'textoSecundario'}>
                  {momentoCorto(chat.ultimo_mensaje)}
                </Texto>
              ) : null}
            </View>
            <View style={estilos.linea}>
              <Texto
                variante="detalle"
                color={sinLeer ? 'texto' : 'textoSecundario'}
                numberOfLines={1}
                style={estilos.flexible}>
                {previa}
              </Texto>
              {sinLeer ? (
                <View style={[estilos.globo, { backgroundColor: colores.primario }]}>
                  <Text
                    style={[estilos.cifra, { color: colores.sobrePrimario }]}
                    allowFontScaling={false}>
                    {chat.no_leidos > 99 ? '99+' : chat.no_leidos}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Presionable>
      );
    });
  }

  return (
    <ScrollView
      style={{ backgroundColor: colores.fondo }}
      refreshControl={
        sesion ? (
          <RefreshControl
            refreshing={conversaciones.isRefetching}
            onRefresh={() => conversaciones.refetch()}
            tintColor="#FFFFFF"
            colors={[colores.primario]}
          />
        ) : undefined
      }
      contentContainerStyle={{
        flexGrow: 1,
        paddingBottom: insets.bottom + ALTO_PESTANAS + espacio.l,
      }}>
      <CabeceraCielo titulo="Chats" subtitulo="Tus amigos y tus grupos." />
      <View style={estilos.contenido}>{contenido}</View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, paddingHorizontal: espacio.m, gap: espacio.xs },
  fila: {
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
  linea: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  flexible: { flex: 1 },
  globo: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cifra: { fontFamily: fuentes.textoFuerte, fontSize: 12 },
});
