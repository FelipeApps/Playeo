import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton } from '@/components/boton';
import { CabeceraCielo } from '@/components/cabecera-cielo';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { ALTO_PESTANAS, useBarraEstado } from '@/components/pantalla';
import { TarjetaEvento, type EventoResumido } from '@/components/tarjeta-evento';
import { Texto } from '@/components/texto';
import { useRegion } from '@/region/contexto';
import { useSesion } from '@/sesion/contexto';
import { useEventos } from '@/social/eventos';
import { espacio, radio, useTema } from '@/theme';

function Grupo({ titulo, eventos }: { titulo: string; eventos: EventoResumido[] }) {
  if (eventos.length === 0) return null;
  return (
    <View style={estilos.grupo}>
      <Texto variante="titulo" accessibilityRole="header">
        {titulo}
      </Texto>
      {eventos.map((evento) => (
        <TarjetaEvento key={evento.id} evento={evento} />
      ))}
    </View>
  );
}

export default function PantallaQuedadas() {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const { sesion, lista } = useSesion();
  const { zona } = useRegion();
  const eventos = useEventos(zona?.id);
  useBarraEstado('clara');

  let contenido;
  if (!lista) {
    contenido = <Esqueleto alto={134} redondeo={radio.l} />;
  } else if (!sesion) {
    contenido = (
      <EstadoVacio
        escena="vacio"
        titulo="Entra para quedar en la playa"
        mensaje="Con una cuenta podrás crear quedadas, apuntarte a las de tus amigos y ver la previsión para ese día.">
        <Boton titulo="Entrar" onPress={() => router.push('/cuenta/entrar')} />
      </EstadoVacio>
    );
  } else if (eventos.isPending) {
    contenido = (
      <View style={estilos.grupo}>
        <Esqueleto alto={134} redondeo={radio.l} />
        <Esqueleto alto={134} redondeo={radio.l} />
      </View>
    );
  } else if (eventos.isError) {
    contenido = (
      <EstadoVacio
        escena="sin-conexion"
        titulo="No se pudieron cargar las quedadas"
        mensaje="Comprueba que tienes conexión con el servidor y vuelve a intentarlo.">
        <Boton titulo="Reintentar" onPress={() => eventos.refetch()} />
      </EstadoVacio>
    );
  } else {
    const todas: EventoResumido[] = eventos.data;
    const invitaciones = todas.filter((e) => e.me_han_invitado);
    const mias = todas.filter(
      (e) => !e.me_han_invitado && (e.mi_respuesta === 'voy' || e.mi_respuesta === 'quiza'),
    );
    const otras = todas.filter((e) => !invitaciones.includes(e) && !mias.includes(e));

    contenido = (
      <>
        <Boton titulo="Crear una quedada" onPress={() => router.push('/evento/nuevo')} />
        {todas.length === 0 ? (
          <EstadoVacio
            escena="vacio"
            titulo="No hay quedadas a la vista"
            mensaje="Crea la primera: elige playa, día y hora, y decide quién puede verla."
          />
        ) : (
          <>
            <Grupo titulo="Te han invitado" eventos={invitaciones} />
            <Grupo titulo="Tus quedadas" eventos={mias} />
            <Grupo titulo={zona ? `En ${zona.nombre}` : 'Otras quedadas'} eventos={otras} />
          </>
        )}
      </>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colores.fondo }}
      refreshControl={
        sesion ? (
          <RefreshControl
            refreshing={eventos.isRefetching}
            onRefresh={() => eventos.refetch()}
            tintColor="#FFFFFF"
            colors={[colores.primario]}
          />
        ) : undefined
      }
      contentContainerStyle={{
        flexGrow: 1,
        paddingBottom: insets.bottom + ALTO_PESTANAS + espacio.l,
      }}>
      <CabeceraCielo titulo="Quedadas" subtitulo="Planes de playa con tu gente." />
      <View style={estilos.contenido}>{contenido}</View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, paddingHorizontal: espacio.m, gap: espacio.l },
  grupo: { gap: espacio.xs },
});
