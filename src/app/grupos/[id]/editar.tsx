import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { Esqueleto } from '@/components/esqueleto';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { mensajeDeError } from '@/lib/supabase';
import { ENLACE_WHATSAPP, useAccionesGrupo, useMisGrupos } from '@/social/grupos';
import { radio } from '@/theme';

const DESCRIPCION_MAXIMA = 300;

interface Datos {
  nombre: string;
  descripcion: string | null;
  enlace_whatsapp: string | null;
}

function Formulario({ id, grupo }: { id: string; grupo: Datos }) {
  const { editar } = useAccionesGrupo();
  const [nombre, setNombre] = useState(grupo.nombre);
  const [descripcion, setDescripcion] = useState(grupo.descripcion ?? '');
  const [enlace, setEnlace] = useState(grupo.enlace_whatsapp ?? '');

  const enlaceLimpio = enlace.trim();
  const enlaceValido = enlaceLimpio.length === 0 || ENLACE_WHATSAPP.test(enlaceLimpio);

  const guardar = () => {
    editar.mutate(
      {
        grupo: id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        enlace_whatsapp: enlaceLimpio || null,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    );
  };

  return (
    <>
      <CampoTexto
        etiqueta="Nombre del grupo"
        value={nombre}
        onChangeText={setNombre}
        maxLength={50}
      />
      <CampoTexto
        etiqueta="Descripción (opcional)"
        ayuda={`${descripcion.length} de ${DESCRIPCION_MAXIMA} caracteres.`}
        value={descripcion}
        onChangeText={setDescripcion}
        maxLength={DESCRIPCION_MAXIMA}
        multiline
        style={estilos.descripcion}
      />
      <CampoTexto
        etiqueta="Grupo de WhatsApp (opcional)"
        ayuda="Pega el enlace de invitación: en WhatsApp, abre el grupo y toca «Enlace de invitación». Solo lo verán los miembros."
        placeholder="https://chat.whatsapp.com/…"
        value={enlace}
        onChangeText={setEnlace}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={
          !enlaceValido
            ? 'Tiene que ser un enlace de invitación de WhatsApp: https://chat.whatsapp.com/…'
            : editar.isError
              ? mensajeDeError(editar.error)
              : undefined
        }
      />
      <Boton
        titulo="Guardar cambios"
        onPress={guardar}
        cargando={editar.isPending}
        deshabilitado={nombre.trim().length < 3 || !enlaceValido}
      />
    </>
  );
}

export default function PantallaEditarGrupo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: grupos } = useMisGrupos();
  const grupo = grupos?.find((candidato) => candidato.id === id);

  return (
    <PantallaFormulario titulo="Editar grupo">
      {grupo ? <Formulario id={id} grupo={grupo} /> : <Esqueleto alto={280} redondeo={radio.l} />}
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  descripcion: { minHeight: 96, textAlignVertical: 'top' },
});
