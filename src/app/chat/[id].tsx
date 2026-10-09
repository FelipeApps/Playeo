import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CIELO_ALTO } from '@/components/ilustracion-playa';
import { useBarraEstado } from '@/components/pantalla';
import { Presionable } from '@/components/presionable';
import { Texto } from '@/components/texto';
import { mensajeDeError } from '@/lib/supabase';
import { useSesion } from '@/sesion/contexto';
import {
  momentoCorto,
  useAccionesChat,
  useChatEnVivo,
  useConversaciones,
  useMensajes,
  useParticipantes,
  type Mensaje,
} from '@/social/chat';
import { espacio, fuentes, radio, useTema } from '@/theme';

const LARGO_MAXIMO = 2000;

export default function PantallaChat() {
  const { id, titulo: tituloInicial } = useLocalSearchParams<{ id: string; titulo?: string }>();
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const { sesion } = useSesion();
  const yo = sesion?.user.id;
  const [texto, setTexto] = useState('');
  useBarraEstado('clara');

  const conversaciones = useConversaciones();
  const mensajes = useMensajes(id);
  const participantes = useParticipantes(id);
  const { escribiendo, avisarEscribiendo } = useChatEnVivo(id);
  const { enviar, borrar, marcarLeida } = useAccionesChat(id);

  const chat = conversaciones.data?.find((candidato) => candidato.id === id);
  const titulo = chat?.titulo ?? tituloInicial ?? 'Chat';
  const esGrupal = chat ? chat.tipo !== 'directa' : (participantes.data?.length ?? 2) > 2;
  const lista = mensajes.data?.pages.flat() ?? [];
  const idMasNuevo = lista[0]?.id;

  // Al abrir el chat y cada vez que llega un mensaje con él abierto, queda leído.
  const marcar = marcarLeida.mutate;
  useEffect(() => {
    if (idMasNuevo != null) marcar();
  }, [idMasNuevo, marcar]);

  const nombres = new Map(participantes.data?.map((p) => [p.id, p.nombre_visible]));

  // "Leído" bajo mi último mensaje, en conversaciones directas, cuando la otra persona
  // ha leído hasta ese momento o después.
  const miUltimo = lista.find((mensaje) => mensaje.autor_id === yo);
  const otra = participantes.data?.find((p) => p.id !== yo);
  const leido =
    !esGrupal && miUltimo != null && otra != null && otra.leido_hasta >= miUltimo.creado;

  const mandar = () => {
    const cuerpo = texto.trim();
    if (!cuerpo || enviar.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTexto('');
    enviar.mutate(cuerpo, {
      // Si falla, el texto vuelve a la caja para no perderlo.
      onError: (fallo) => {
        setTexto(cuerpo);
        Alert.alert('No se pudo enviar', mensajeDeError(fallo));
      },
    });
  };

  const opcionesDe = (mensaje: Mensaje) => {
    if (mensaje.autor_id === yo) {
      Alert.alert('Tu mensaje', mensaje.cuerpo, [
        { text: 'Borrar', style: 'destructive', onPress: () => borrar.mutate(mensaje.id) },
        { text: 'Cancelar', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert(nombres.get(mensaje.autor_id) ?? 'Mensaje', mensaje.cuerpo, [
      {
        text: 'Reportar mensaje',
        style: 'destructive',
        onPress: () =>
          router.push({
            pathname: '/reportar',
            params: {
              usuario: mensaje.autor_id,
              nombre: nombres.get(mensaje.autor_id) ?? 'esta persona',
              mensaje: String(mensaje.id),
              contenido: mensaje.cuerpo,
            },
          }),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const renderMensaje = ({ item, index }: { item: Mensaje; index: number }) => {
    const mio = item.autor_id === yo;
    // La lista va invertida: el siguiente índice es el mensaje anterior en el tiempo.
    const anterior = lista[index + 1];
    const cambiaAutor = anterior?.autor_id !== item.autor_id;

    return (
      <View style={[estilos.renglon, mio ? estilos.aLaDerecha : estilos.aLaIzquierda]}>
        {esGrupal && !mio && cambiaAutor ? (
          <Texto variante="etiqueta" color="primario" style={estilos.autor}>
            {nombres.get(item.autor_id) ?? 'Alguien'}
          </Texto>
        ) : null}
        <Pressable
          accessibilityLabel={`${mio ? 'Tú' : (nombres.get(item.autor_id) ?? 'Alguien')}: ${item.cuerpo}. ${momentoCorto(item.creado)}`}
          accessibilityHint="Mantén pulsado para ver opciones"
          onLongPress={() => {
            Haptics.selectionAsync();
            opcionesDe(item);
          }}
          style={[
            estilos.burbuja,
            mio
              ? { backgroundColor: colores.primario, borderBottomRightRadius: 6 }
              : {
                  backgroundColor: colores.superficie,
                  borderColor: colores.borde,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderBottomLeftRadius: 6,
                },
          ]}>
          <Text style={[estilos.cuerpo, { color: mio ? colores.sobrePrimario : colores.texto }]}>
            {item.cuerpo}
          </Text>
          <Text
            style={[
              estilos.hora,
              { color: mio ? colores.sobrePrimario : colores.textoSecundario, opacity: mio ? 0.8 : 1 },
            ]}>
            {momentoCorto(item.creado)}
          </Text>
        </Pressable>
        {leido && item.id === miUltimo?.id ? (
          <Texto variante="etiqueta" color="textoSecundario" style={estilos.leido}>
            Leído
          </Texto>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={0}
      style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <View style={[estilos.barra, { paddingTop: insets.top + espacio.xs }]}>
        <Presionable
          accessibilityLabel="Volver"
          hitSlop={6}
          onPress={() => router.back()}
          style={estilos.volver}>
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </Presionable>
        <View style={estilos.titulos}>
          <Text style={estilos.titulo} numberOfLines={1} accessibilityRole="header">
            {titulo}
          </Text>
          <Text style={estilos.subtitulo} numberOfLines={1} accessibilityLiveRegion="polite">
            {escribiendo
              ? `${escribiendo} está escribiendo…`
              : esGrupal
                ? `${participantes.data?.length ?? ''} participantes`
                : 'Conversación privada'}
          </Text>
        </View>
      </View>

      <FlatList
        data={lista}
        inverted
        keyExtractor={(mensaje) => String(mensaje.id)}
        renderItem={renderMensaje}
        contentContainerStyle={estilos.lista}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (mensajes.hasNextPage && !mensajes.isFetchingNextPage) mensajes.fetchNextPage();
        }}
        // Con la lista invertida, el "pie" queda arriba: ahí se cargan los antiguos.
        ListFooterComponent={
          mensajes.isFetchingNextPage ? <ActivityIndicator color={colores.primario} /> : null
        }
        ListEmptyComponent={
          <View style={estilos.vacio}>
            {mensajes.isPending ? (
              <ActivityIndicator color={colores.primario} />
            ) : mensajes.isError ? (
              <Texto color="textoSecundario" style={estilos.centrado}>
                No se pudieron cargar los mensajes. Comprueba la conexión.
              </Texto>
            ) : (
              <Texto color="textoSecundario" style={estilos.centrado}>
                Aún no hay mensajes. Escribe el primero.
              </Texto>
            )}
          </View>
        }
      />

      <View
        style={[
          estilos.redaccion,
          {
            paddingBottom: insets.bottom + espacio.xs,
            backgroundColor: colores.superficie,
            borderTopColor: colores.borde,
          },
        ]}>
        <TextInput
          accessibilityLabel="Escribe un mensaje"
          placeholder="Escribe un mensaje"
          placeholderTextColor={colores.textoSecundario}
          selectionColor={colores.primario}
          value={texto}
          onChangeText={(nuevo) => {
            setTexto(nuevo);
            if (nuevo.length > 0) avisarEscribiendo();
          }}
          maxLength={LARGO_MAXIMO}
          multiline
          style={[
            estilos.caja,
            { color: colores.texto, backgroundColor: colores.fondo, borderColor: colores.borde },
          ]}
        />
        <Presionable
          accessibilityLabel="Enviar"
          accessibilityState={{ disabled: texto.trim().length === 0 }}
          disabled={texto.trim().length === 0}
          onPress={mandar}
          style={[
            estilos.enviar,
            { backgroundColor: colores.primario, opacity: texto.trim().length === 0 ? 0.4 : 1 },
          ]}>
          <Feather name="send" size={20} color={colores.sobrePrimario} />
        </Presionable>
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingHorizontal: espacio.m,
    paddingBottom: espacio.s,
    backgroundColor: CIELO_ALTO,
  },
  volver: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,20,30,0.3)',
  },
  titulos: { flex: 1 },
  titulo: { fontFamily: fuentes.titulo, fontSize: 19, color: '#FFFFFF', letterSpacing: -0.2 },
  subtitulo: { fontFamily: fuentes.textoMedio, fontSize: 13, color: '#E3EEF3' },
  lista: { flexGrow: 1, paddingHorizontal: espacio.m, paddingVertical: espacio.s },
  renglon: { marginTop: espacio.xxs + 2, maxWidth: '84%' },
  aLaDerecha: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  aLaIzquierda: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  autor: { marginLeft: espacio.s, marginTop: espacio.xs, marginBottom: 2 },
  burbuja: {
    paddingHorizontal: espacio.s + 2,
    paddingVertical: espacio.xs,
    borderRadius: radio.l - 4,
    gap: 2,
  },
  cuerpo: { fontFamily: fuentes.texto, fontSize: 16, lineHeight: 22 },
  hora: { fontFamily: fuentes.textoMedio, fontSize: 11, alignSelf: 'flex-end' },
  leido: { marginTop: 2, marginRight: espacio.xxs },
  // La lista está invertida: el vacío también, así que se le da la vuelta para leerlo.
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl, transform: [{ scaleY: -1 }] },
  centrado: { textAlign: 'center' },
  redaccion: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espacio.xs,
    paddingHorizontal: espacio.s,
    paddingTop: espacio.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  caja: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    paddingHorizontal: espacio.m,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: radio.l,
    borderWidth: 1,
    fontFamily: fuentes.texto,
    fontSize: 16,
  },
  enviar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
