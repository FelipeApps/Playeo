import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StyleSheet, View } from 'react-native';

import { BotonEmergencia } from '@/components/boton-emergencia';

import { usePreferencias } from '@/preferencias/contexto';
import { useRegion } from '@/region/contexto';
import { useConversaciones, useEscucharChats } from '@/social/chat';
import { useTema } from '@/theme';

export default function LayoutPestanas() {
  const { colores } = useTema();
  const { zona, lista } = useRegion();
  const { preferencias, lista: preferenciasListas } = usePreferencias();
  const { data: conversaciones } = useConversaciones();
  useEscucharChats();

  const sinLeer = conversaciones?.reduce((suma, chat) => suma + chat.no_leidos, 0) ?? 0;

  // Antes de ver nada: primero qué te interesa y después en qué zona.
  if (!lista || !preferenciasListas) return null;
  if (!preferencias.interes) return <Redirect href="/bienvenida" />;
  if (!zona) return <Redirect href="/zona" />;

  return (
    <View style={estilos.raiz}>
      <NativeTabs
        tintColor={colores.primario}
        backgroundColor={colores.superficie}
        labelStyle={{ selected: { color: colores.texto } }}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
          <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="explorar">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'safari', selected: 'safari.fill' }}
            md="explore"
          />
          <NativeTabs.Trigger.Label>Explorar</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="quedadas">
          <NativeTabs.Trigger.Icon sf="calendar" md="event" />
          <NativeTabs.Trigger.Label>Quedadas</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="chats">
          <NativeTabs.Trigger.Icon
            sf={{
              default: 'bubble.left.and.bubble.right',
              selected: 'bubble.left.and.bubble.right.fill',
            }}
            md="forum"
          />
          <NativeTabs.Trigger.Label>Chats</NativeTabs.Trigger.Label>
          {sinLeer > 0 ? (
            <NativeTabs.Trigger.Badge>
              {sinLeer > 99 ? '99+' : String(sinLeer)}
            </NativeTabs.Trigger.Badge>
          ) : null}
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="perfil">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person', selected: 'person.fill' }}
            md="person"
          />
          <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      {/* Siempre a mano, sobre cualquier pestaña. */}
      <BotonEmergencia />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
});
