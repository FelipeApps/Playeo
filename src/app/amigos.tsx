import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { FilaUsuario } from '@/components/fila-usuario';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import { useSesion } from '@/sesion/contexto';
import {
  useAccionesSociales,
  useBuscarUsuarios,
  useRelaciones,
  useRetardado,
  type UsuarioConRelacion,
} from '@/social/amigos';
import { espacio, radio } from '@/theme';

/** Botones de una fila según la relación con esa persona. */
function Acciones({ usuario }: { usuario: UsuarioConRelacion }) {
  const { solicitar, aceptar, eliminar } = useAccionesSociales();
  const ocupado = solicitar.isPending || aceptar.isPending || eliminar.isPending;

  if (usuario.relacion === 'ninguna') {
    return (
      <Boton
        compacto
        titulo="Añadir"
        cargando={ocupado}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          solicitar.mutate(usuario.id);
        }}
      />
    );
  }
  if (usuario.relacion === 'solicitud_recibida') {
    return (
      <>
        <Boton
          compacto
          titulo="Rechazar"
          variante="secundario"
          deshabilitado={ocupado}
          onPress={() => eliminar.mutate(usuario.id)}
        />
        <Boton
          compacto
          titulo="Aceptar"
          cargando={aceptar.isPending}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            aceptar.mutate(usuario.id);
          }}
        />
      </>
    );
  }
  if (usuario.relacion === 'solicitud_enviada') {
    return (
      <Boton
        compacto
        titulo="Cancelar"
        variante="secundario"
        cargando={ocupado}
        onPress={() => eliminar.mutate(usuario.id)}
      />
    );
  }
  return null;
}

function Grupo({ titulo, usuarios }: { titulo: string; usuarios: UsuarioConRelacion[] }) {
  if (usuarios.length === 0) return null;
  return (
    <View style={estilos.grupo}>
      <Texto variante="subtitulo" accessibilityRole="header">
        {titulo}
      </Texto>
      {usuarios.map((usuario) => (
        <FilaUsuario key={usuario.id} usuario={usuario}>
          <Acciones usuario={usuario} />
        </FilaUsuario>
      ))}
    </View>
  );
}

export default function PantallaAmigos() {
  const { sesion } = useSesion();
  const [texto, setTexto] = useState('');
  const busqueda = useRetardado(texto.trim());
  const buscando = busqueda.length >= 2;
  const resultados = useBuscarUsuarios(busqueda);
  const relaciones = useRelaciones();

  if (!sesion) {
    return (
      <PantallaFormulario titulo="Amigos">
        <EstadoVacio
          escena="vacio"
          titulo="Entra para ver a tus amigos"
          mensaje="Necesitas una cuenta para añadir amigos y quedar con ellos.">
          <Boton titulo="Entrar" onPress={() => router.replace('/cuenta/entrar')} />
        </EstadoVacio>
      </PantallaFormulario>
    );
  }

  const todas = relaciones.data ?? [];
  const recibidas = todas.filter((u) => u.relacion === 'solicitud_recibida');
  const amigos = todas.filter((u) => u.relacion === 'amigo');
  const enviadas = todas.filter((u) => u.relacion === 'solicitud_enviada');

  let contenido;
  if (buscando) {
    if (resultados.isPending) {
      contenido = <Esqueleto alto={74} redondeo={radio.l} />;
    } else if (resultados.isError) {
      contenido = (
        <Texto color="textoSecundario">
          No se pudo buscar. Comprueba la conexión y vuelve a intentarlo.
        </Texto>
      );
    } else if (resultados.data.length === 0) {
      contenido = (
        <Texto color="textoSecundario">
          No hay nadie con «{busqueda}» en su nombre de usuario.
        </Texto>
      );
    } else {
      contenido = <Grupo titulo="Resultados" usuarios={resultados.data} />;
    }
  } else if (relaciones.isPending) {
    contenido = (
      <View style={estilos.grupo}>
        <Esqueleto alto={74} redondeo={radio.l} />
        <Esqueleto alto={74} redondeo={radio.l} />
      </View>
    );
  } else if (relaciones.isError) {
    contenido = (
      <EstadoVacio
        escena="sin-conexion"
        titulo="No se pudo cargar tu lista"
        mensaje="Comprueba que tienes conexión con el servidor y vuelve a intentarlo.">
        <Boton titulo="Reintentar" onPress={() => relaciones.refetch()} />
      </EstadoVacio>
    );
  } else if (todas.length === 0) {
    contenido = (
      <EstadoVacio
        escena="vacio"
        titulo="Aún no tienes amigos aquí"
        mensaje="Busca a tu gente por su nombre de usuario y envíales una solicitud."
      />
    );
  } else {
    contenido = (
      <>
        <Grupo titulo="Solicitudes recibidas" usuarios={recibidas} />
        <Grupo titulo="Tus amigos" usuarios={amigos} />
        <Grupo titulo="Solicitudes enviadas" usuarios={enviadas} />
      </>
    );
  }

  return (
    <PantallaFormulario titulo="Amigos" subtitulo="Tu gente para ir a la playa.">
      <CampoTexto
        etiqueta="Buscar por nombre de usuario"
        value={texto}
        onChangeText={setTexto}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        ayuda="Escribe al menos dos letras."
      />
      {contenido}
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espacio.xs },
});
