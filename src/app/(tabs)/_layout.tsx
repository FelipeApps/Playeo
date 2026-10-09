import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useRegion } from '@/region/contexto';
import { useConversaciones, useEscucharChats } from '@/social/chat';
import { useTema } from '@/theme';

export default function LayoutPestanas() {
  const { colores } = useTema();
  const { zona, lista } = useRegion();
  const { data: conversaciones } = useConversaciones();
  useEscucharChats();

  const sinLeer = conversaciones?.reduce((suma, chat) => suma + chat.no_leidos, 0) ?? 0;

  // Antes de ver ninguna playa hay que elegir zona.
  if (!lista) return null;
  if (!zona) return <Redirect href="/zona" />;

  return (
    <NativeTabs
      tintColor={colores.primario}
      backgroundColor={colores.superficie}
      labelStyle={{ selected: { color: colores.texto } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="wb_sunny" />
        <NativeTabs.Trigger.Label>Hoy</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mapa">
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="map" />
        <NativeTabs.Trigger.Label>Mapa</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="quedadas">
        <NativeTabs.Trigger.Icon sf="calendar" md="event" />
        <NativeTabs.Trigger.Label>Quedadas</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chats">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md="forum"
        />
        <NativeTabs.Trigger.Label>Chats</NativeTabs.Trigger.Label>
        {sinLeer > 0 ? (
          <NativeTabs.Trigger.Badge>{sinLeer > 99 ? '99+' : String(sinLeer)}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
