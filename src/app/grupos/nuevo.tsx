import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { mensajeDeError } from '@/lib/supabase';
import { useAccionesGrupo } from '@/social/grupos';

const NOMBRE_MINIMO = 3;
const DESCRIPCION_MAXIMA = 300;

export default function PantallaNuevoGrupo() {
  const { crear } = useAccionesGrupo();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const guardar = () => {
    crear.mutate(
      { nombre: nombre.trim(), descripcion },
      {
        onSuccess: (id) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Se sustituye el formulario por el grupo recién creado, listo para invitar.
          router.replace({ pathname: '/grupos/[id]', params: { id } });
        },
      },
    );
  };

  return (
    <PantallaFormulario titulo="Crear un grupo" subtitulo="Después podrás invitar a tus amigos.">
      <CampoTexto
        etiqueta="Nombre del grupo"
        ayuda="Por ejemplo, Surferos del norte."
        value={nombre}
        onChangeText={setNombre}
        maxLength={50}
        autoFocus
      />
      <CampoTexto
        etiqueta="Descripción (opcional)"
        ayuda={`${descripcion.length} de ${DESCRIPCION_MAXIMA} caracteres.`}
        value={descripcion}
        onChangeText={setDescripcion}
        maxLength={DESCRIPCION_MAXIMA}
        multiline
        style={estilos.descripcion}
        error={crear.isError ? mensajeDeError(crear.error) : undefined}
      />
      <Boton
        titulo="Crear grupo"
        onPress={guardar}
        cargando={crear.isPending}
        deshabilitado={nombre.trim().length < NOMBRE_MINIMO}
      />
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  descripcion: { minHeight: 96, textAlignVertical: 'top' },
});
