import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { Esqueleto } from '@/components/esqueleto';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import { mensajeDeError, type Perfil } from '@/lib/supabase';
import { useActualizarPerfil, useMiPerfil } from '@/sesion/contexto';
import { elegirYSubirFoto } from '@/sesion/foto';
import { espacio, radio } from '@/theme';

const FORMATO_USUARIO = /^[a-zA-Z0-9_.]{3,24}$/;
const BIO_MAXIMA = 160;

function Formulario({ perfil }: { perfil: Perfil }) {
  const actualizar = useActualizarPerfil();
  const [nombre, setNombre] = useState(perfil.nombre_visible);
  const [usuario, setUsuario] = useState(perfil.nombre_usuario);
  const [bio, setBio] = useState(perfil.bio ?? '');
  const [rutaFoto, setRutaFoto] = useState(perfil.ruta_foto);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string>();

  const cambiarFoto = async () => {
    setError(undefined);
    setSubiendo(true);
    try {
      const ruta = await elegirYSubirFoto(perfil.id, rutaFoto);
      if (ruta) {
        setRutaFoto(ruta);
        // Se guarda al momento: la foto anterior ya se ha borrado del servidor.
        await actualizar.mutateAsync({ ruta_foto: ruta });
      }
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    setError(undefined);
    try {
      await actualizar.mutateAsync({
        nombre_visible: nombre.trim(),
        nombre_usuario: usuario,
        bio: bio.trim() || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  };

  const usuarioValido = FORMATO_USUARIO.test(usuario);

  return (
    <>
      <View style={estilos.foto}>
        <Avatar ruta={rutaFoto} nombre={nombre} tamano={96} />
        <Boton
          titulo="Cambiar foto"
          variante="secundario"
          onPress={cambiarFoto}
          cargando={subiendo}
        />
      </View>

      <CampoTexto etiqueta="Nombre" value={nombre} onChangeText={setNombre} maxLength={50} />
      <CampoTexto
        etiqueta="Nombre de usuario"
        value={usuario}
        onChangeText={(texto) => setUsuario(texto.trim())}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={24}
        error={
          usuarioValido ? undefined : 'De 3 a 24 caracteres: letras, números, punto o guion bajo.'
        }
      />

      <CampoTexto
        etiqueta="Sobre ti"
        ayuda={`${bio.length} de ${BIO_MAXIMA} caracteres.`}
        value={bio}
        onChangeText={setBio}
        maxLength={BIO_MAXIMA}
        multiline
        style={estilos.bio}
      />

      {error ? (
        <Texto variante="detalle" color="error" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : null}
      <Boton
        titulo="Guardar cambios"
        onPress={guardar}
        cargando={actualizar.isPending && !subiendo}
        deshabilitado={nombre.trim().length === 0 || !usuarioValido}
      />
    </>
  );
}

export default function PantallaEditarPerfil() {
  const { data: perfil } = useMiPerfil();

  return (
    <PantallaFormulario titulo="Editar perfil">
      {perfil ? <Formulario perfil={perfil} /> : <Esqueleto alto={320} redondeo={radio.l} />}
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  foto: { alignItems: 'center', gap: espacio.s },
  bio: { minHeight: 96, textAlignVertical: 'top' },
});
