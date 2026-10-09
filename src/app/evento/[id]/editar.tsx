import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoFechaHora } from '@/components/campo-fecha-hora';
import { CampoTexto } from '@/components/campo-texto';
import { Esqueleto } from '@/components/esqueleto';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import { mensajeDeError } from '@/lib/supabase';
import { useAccionesEvento, useEvento } from '@/social/eventos';
import { ENLACE_WHATSAPP } from '@/social/grupos';
import { radio } from '@/theme';

const DESCRIPCION_MAXIMA = 500;

interface Datos {
  titulo: string;
  descripcion: string | null;
  empieza: string;
  plazas_maximas: number | null;
  enlace_whatsapp: string | null;
  van: number;
  tipo_sitio: 'catalogo_con_estado' | 'catalogo' | 'manual';
  lugar_nombre: string;
  ubicacion_direccion: string | null;
}

function Formulario({ id, evento }: { id: string; evento: Datos }) {
  const { editar } = useAccionesEvento();
  const [titulo, setTitulo] = useState(evento.titulo);
  const [empieza, setEmpieza] = useState(() => new Date(evento.empieza));
  const [descripcion, setDescripcion] = useState(evento.descripcion ?? '');
  const [plazas, setPlazas] = useState(evento.plazas_maximas?.toString() ?? '');
  const [enlace, setEnlace] = useState(evento.enlace_whatsapp ?? '');
  // El sitio solo se edita aquí cuando se escribió a mano.
  const esManual = evento.tipo_sitio === 'manual';
  const [sitio, setSitio] = useState(evento.lugar_nombre);
  const [direccion, setDireccion] = useState(evento.ubicacion_direccion ?? '');
  const [ahora] = useState(() => new Date());

  const numeroPlazas = plazas.trim() === '' ? null : Number(plazas);
  const plazasValidas =
    numeroPlazas == null ||
    (Number.isInteger(numeroPlazas) && numeroPlazas >= 2 && numeroPlazas <= 500);
  // No se puede dejar fuera a quien ya ha dicho que va.
  const cabenLosQueVan = numeroPlazas == null || numeroPlazas >= evento.van;
  const enlaceLimpio = enlace.trim();
  const enlaceValido = enlaceLimpio === '' || ENLACE_WHATSAPP.test(enlaceLimpio);

  const guardar = () => {
    editar.mutate(
      {
        evento: id,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        empieza: empieza.toISOString(),
        plazas_maximas: numeroPlazas,
        enlace_whatsapp: enlaceLimpio || null,
        ...(esManual
          ? { ubicacion_nombre: sitio.trim(), ubicacion_direccion: direccion.trim() || null }
          : {}),
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
      <CampoTexto etiqueta="Título" value={titulo} onChangeText={setTitulo} maxLength={80} />
      {esManual ? (
        <>
          <CampoTexto
            etiqueta="Nombre del sitio"
            value={sitio}
            onChangeText={setSitio}
            maxLength={120}
          />
          <CampoTexto
            etiqueta="Dirección exacta (opcional)"
            ayuda="Solo la verá quien se apunte."
            value={direccion}
            onChangeText={setDireccion}
            maxLength={300}
          />
        </>
      ) : null}
      <CampoFechaHora etiqueta="Cuándo" valor={empieza} alCambiar={setEmpieza} minimo={ahora} />
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
        etiqueta="Plazas (opcional)"
        ayuda="Contándote a ti. Déjalo vacío si no hay límite."
        value={plazas}
        onChangeText={(texto) => setPlazas(texto.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={3}
        error={
          !plazasValidas
            ? 'Tiene que ser un número entre 2 y 500.'
            : !cabenLosQueVan
              ? `Ya van ${evento.van} personas: no puedes poner menos plazas.`
              : undefined
        }
      />
      <CampoTexto
        etiqueta="Grupo de WhatsApp (opcional)"
        ayuda="Solo lo verá quien se apunte."
        placeholder="https://chat.whatsapp.com/…"
        value={enlace}
        onChangeText={setEnlace}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={
          enlaceValido
            ? undefined
            : 'Tiene que ser un enlace de invitación de WhatsApp: https://chat.whatsapp.com/…'
        }
      />
      <Texto variante="detalle" color="textoSecundario">
        Si cambias el día o la hora, avisa por el chat: quien ya se apuntó no recibe un aviso
        automático.
      </Texto>
      {editar.isError ? (
        <Texto variante="detalle" color="error" accessibilityLiveRegion="polite">
          {mensajeDeError(editar.error)}
        </Texto>
      ) : null}
      <Boton
        titulo="Guardar cambios"
        onPress={guardar}
        cargando={editar.isPending}
        deshabilitado={
          titulo.trim().length < 3 ||
          (esManual && sitio.trim().length < 2) ||
          empieza <= ahora ||
          !plazasValidas ||
          !cabenLosQueVan ||
          !enlaceValido
        }
      />
    </>
  );
}

export default function PantallaEditarEvento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: evento } = useEvento(id);

  return (
    <PantallaFormulario titulo="Editar quedada">
      {evento ? (
        <Formulario id={id} evento={evento} />
      ) : (
        <Esqueleto alto={320} redondeo={radio.l} />
      )}
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  descripcion: { minHeight: 96, textAlignVertical: 'top' },
});
