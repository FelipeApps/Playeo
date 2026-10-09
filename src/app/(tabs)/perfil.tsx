import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Boton } from '@/components/boton';
import { CabeceraCielo } from '@/components/cabecera-cielo';
import { Esqueleto } from '@/components/esqueleto';
import { ALTO_PESTANAS, useBarraEstado } from '@/components/pantalla';
import { Seccion } from '@/components/seccion';
import { SeccionPreferencias } from '@/components/seccion-preferencias';
import { Segmentado } from '@/components/segmentado';
import { Texto } from '@/components/texto';
import { mensajeDeError, supabase, supabaseConfigurado, type Privacidad } from '@/lib/supabase';
import { useRegion } from '@/region/contexto';
import { useActualizarPerfil, useMiPerfil, useSesion } from '@/sesion/contexto';
import { useRelaciones } from '@/social/amigos';
import { useInvitacionesGrupo, useMisGrupos } from '@/social/grupos';
import { espacio, radio, sombra, useTema } from '@/theme';

const PRIVACIDADES: { valor: Privacidad; etiqueta: string }[] = [
  { valor: 'publico', etiqueta: 'Público' },
  { valor: 'amigos', etiqueta: 'Solo amigos' },
];

const AYUDA_PRIVACIDAD: Record<Privacidad, string> = {
  publico: 'Cualquier persona registrada puede ver tu perfil.',
  amigos: 'Solo tus amigos ven tu perfil. Los demás pueden encontrarte por tu nombre de usuario para enviarte una solicitud.',
};

/** Resumen de amigos con acceso a la lista y a las solicitudes pendientes. */
function SeccionAmigos() {
  const { data: relaciones } = useRelaciones();
  const amigos = relaciones?.filter((u) => u.relacion === 'amigo').length ?? 0;
  const pendientes = relaciones?.filter((u) => u.relacion === 'solicitud_recibida').length ?? 0;

  return (
    <Seccion titulo="Amigos">
      <Texto variante="subtitulo">
        {amigos === 0 ? 'Aún no tienes amigos' : amigos === 1 ? '1 amigo' : `${amigos} amigos`}
      </Texto>
      {pendientes > 0 ? (
        <Texto variante="detalle" color="primario">
          {pendientes === 1
            ? 'Tienes 1 solicitud por responder.'
            : `Tienes ${pendientes} solicitudes por responder.`}
        </Texto>
      ) : null}
      <Boton
        titulo={pendientes > 0 ? 'Ver solicitudes' : 'Buscar y ver amigos'}
        onPress={() => router.push('/amigos')}
      />
    </Seccion>
  );
}

/** Resumen de grupos con acceso a la lista y a las invitaciones pendientes. */
function SeccionGrupos() {
  const { data: grupos } = useMisGrupos();
  const { data: invitaciones } = useInvitacionesGrupo();
  const total = grupos?.length ?? 0;
  const pendientes = invitaciones?.length ?? 0;

  return (
    <Seccion titulo="Grupos">
      <Texto variante="subtitulo">
        {total === 0 ? 'Aún no estás en ningún grupo' : total === 1 ? '1 grupo' : `${total} grupos`}
      </Texto>
      {pendientes > 0 ? (
        <Texto variante="detalle" color="primario">
          {pendientes === 1
            ? 'Tienes 1 invitación por responder.'
            : `Tienes ${pendientes} invitaciones por responder.`}
        </Texto>
      ) : null}
      <Boton
        titulo={pendientes > 0 ? 'Ver invitaciones' : 'Ver y crear grupos'}
        variante={pendientes > 0 ? 'principal' : 'secundario'}
        onPress={() => router.push('/grupos')}
      />
    </Seccion>
  );
}

/** Zona de costa elegida, con acceso al selector. */
function SeccionZona() {
  const { zona } = useRegion();

  return (
    <Seccion titulo="Tu zona" descripcion="Las playas que ves en Hoy y en el mapa.">
      <Texto variante="subtitulo">{zona?.nombre}</Texto>
      <Boton
        titulo="Cambiar de zona"
        variante="secundario"
        onPress={() => router.push('/zona')}
      />
    </Seccion>
  );
}

/** Invitación a crear cuenta, para quien usa la app sin sesión. */
function SinSesion() {
  const { colores, esOscuro } = useTema();

  if (!supabaseConfigurado) {
    return (
      <View style={[estilos.invitacion, { backgroundColor: colores.arena }]}>
        <Texto variante="subtitulo" color="sobreArena">
          Las funciones sociales no están configuradas
        </Texto>
        <Texto variante="detalle" color="sobreArena">
          Falta el archivo .env.local con la dirección de Supabase. El ranking y el mapa
          funcionan igual sin él.
        </Texto>
      </View>
    );
  }

  return (
    <View
      style={[
        estilos.invitacion,
        sombra(esOscuro),
        { backgroundColor: colores.superficie, borderColor: colores.borde },
      ]}>
      <Texto variante="titulo">Queda con tu gente en la playa</Texto>
      <Texto color="textoSecundario">
        Con una cuenta podrás añadir amigos, crear grupos y organizar quedadas en tu playa
        favorita.
      </Texto>
      <Boton titulo="Crear cuenta" onPress={() => router.push('/cuenta/registro')} />
      <Boton
        titulo="Ya tengo cuenta"
        variante="secundario"
        onPress={() => router.push('/cuenta/entrar')}
      />
    </View>
  );
}

function ConSesion() {
  const { colores, esOscuro } = useTema();
  const { sesion } = useSesion();
  const { data: perfil, isPending, isError, refetch } = useMiPerfil();
  const actualizar = useActualizarPerfil();
  const { zona } = useRegion();
  const [ocupado, setOcupado] = useState<'exportar' | 'borrar' | null>(null);

  const exportar = async () => {
    setOcupado('exportar');
    const { data, error } = await supabase.rpc('exportar_mis_datos');
    setOcupado(null);
    if (error) Alert.alert('No se pudo exportar', mensajeDeError(error));
    else await Share.share({ title: 'Mis datos de Playeo', message: JSON.stringify(data, null, 2) });
  };

  const borrar = async () => {
    setOcupado('borrar');
    const { error } = await supabase.functions.invoke('borrar-cuenta', { method: 'POST' });
    setOcupado(null);
    if (error) {
      Alert.alert('No se pudo borrar la cuenta', mensajeDeError(error));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // La cuenta ya no existe en el servidor: solo queda limpiar la sesión del móvil.
    await supabase.auth.signOut({ scope: 'local' });
  };

  const confirmarBorrado = () => {
    Alert.alert(
      'Borrar tu cuenta',
      'Se eliminarán tu perfil, tu foto y todo lo que hayas creado. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar cuenta', style: 'destructive', onPress: borrar },
      ],
    );
  };

  if (isPending) return <Esqueleto alto={190} redondeo={radio.l} />;

  if (isError || !perfil) {
    return (
      <View style={[estilos.invitacion, { backgroundColor: colores.arena }]}>
        <Texto variante="subtitulo" color="sobreArena">
          No hemos podido cargar tu perfil
        </Texto>
        <Texto variante="detalle" color="sobreArena">
          Comprueba que Supabase está arrancado y que el móvil está en la misma wifi.
        </Texto>
        <Boton titulo="Reintentar" onPress={() => refetch()} />
        <Boton titulo="Cerrar sesión" variante="secundario" onPress={() => supabase.auth.signOut()} />
      </View>
    );
  }

  return (
    <>
      <View
        style={[
          estilos.ficha,
          sombra(esOscuro),
          { backgroundColor: colores.superficie, borderColor: colores.borde },
        ]}>
        <View style={estilos.identidad}>
          <Avatar ruta={perfil.ruta_foto} nombre={perfil.nombre_visible} tamano={76} />
          <View style={estilos.nombres}>
            <Texto variante="titulo" numberOfLines={2}>
              {perfil.nombre_visible}
            </Texto>
            <Texto variante="detalle" color="textoSecundario">
              @{perfil.nombre_usuario}
              {zona ? `, ${zona.nombre}` : ''}
            </Texto>
          </View>
        </View>
        <Texto color={perfil.bio ? 'texto' : 'textoSecundario'}>
          {perfil.bio ?? 'Aún no has escrito nada sobre ti.'}
        </Texto>
        <Boton
          titulo="Editar perfil"
          variante="secundario"
          onPress={() => router.push('/cuenta/editar')}
        />
      </View>

      <SeccionAmigos />
      <SeccionGrupos />
      <SeccionZona />
      <SeccionPreferencias />

      <Seccion titulo="Privacidad">
        <Segmentado
          etiqueta="Quién puede ver tu perfil"
          opciones={PRIVACIDADES}
          valor={perfil.privacidad}
          alCambiar={(privacidad) => actualizar.mutate({ privacidad })}
        />
        <Texto variante="detalle" color="textoSecundario">
          {AYUDA_PRIVACIDAD[perfil.privacidad]}
        </Texto>
        <Boton
          titulo="Personas bloqueadas"
          variante="secundario"
          onPress={() => router.push('/bloqueados')}
        />
      </Seccion>

      <Seccion titulo="Tu cuenta" descripcion={sesion?.user.email}>
        <Boton
          titulo="Exportar mis datos"
          variante="secundario"
          onPress={exportar}
          cargando={ocupado === 'exportar'}
        />
        <Boton titulo="Cerrar sesión" variante="secundario" onPress={() => supabase.auth.signOut()} />
        <Boton
          titulo="Borrar mi cuenta"
          variante="peligro"
          onPress={confirmarBorrado}
          cargando={ocupado === 'borrar'}
        />
      </Seccion>
    </>
  );
}

export default function PantallaPerfil() {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const { sesion, lista } = useSesion();
  useBarraEstado('clara');

  return (
    <ScrollView
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={{ paddingBottom: insets.bottom + ALTO_PESTANAS + espacio.l }}>
      <CabeceraCielo titulo="Perfil" subtitulo="Tu cuenta y tu playa ideal." />
      <View style={estilos.contenido}>
        {!lista ? (
          <Esqueleto alto={190} redondeo={radio.l} />
        ) : sesion ? (
          <ConSesion />
        ) : (
          <>
            <SinSesion />
            <SeccionZona />
            <SeccionPreferencias />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { paddingHorizontal: espacio.m, gap: espacio.l },
  invitacion: {
    padding: espacio.l,
    gap: espacio.s,
    borderRadius: radio.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  ficha: {
    padding: espacio.m,
    gap: espacio.m,
    borderRadius: radio.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  identidad: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  nombres: { flex: 1, gap: 2 },
});
