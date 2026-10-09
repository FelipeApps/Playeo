import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { ROJO_EMERGENCIA } from '@/components/boton-emergencia';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Presionable } from '@/components/presionable';
import { Seccion } from '@/components/seccion';
import { Texto } from '@/components/texto';
import { useRegion } from '@/region/contexto';
import {
  abrirSms,
  abrirWhatsapp,
  llamarEmergencias,
  obtenerPosicion,
  quedadaEnCurso,
  redactarAviso,
} from '@/seguridad/aviso';
import { useContactoConfianza } from '@/seguridad/contacto';
import { useEventos } from '@/social/eventos';
import { espacio, fuentes, radio } from '@/theme';

type Canal = 'whatsapp' | 'sms';

export default function PantallaEmergencia() {
  const { zona } = useRegion();
  const { data: eventos } = useEventos(zona?.id);
  const { contacto, listo } = useContactoConfianza();
  const [preparando, setPreparando] = useState<Canal>();
  const [fallo, setFallo] = useState<string>();

  const llamar = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    llamarEmergencias().catch(() => setFallo('No se ha podido abrir el teléfono. Marca el 112.'));
  };

  const avisar = async (canal: Canal) => {
    if (!contacto || preparando) return;
    setFallo(undefined);
    setPreparando(canal);
    const posicion = await obtenerPosicion();
    const texto = redactarAviso(posicion, quedadaEnCurso(eventos, Date.now()));
    try {
      await (canal === 'whatsapp' ? abrirWhatsapp : abrirSms)(contacto.telefono, texto);
    } catch {
      setFallo(
        canal === 'whatsapp'
          ? 'No se ha podido abrir WhatsApp. Prueba con el SMS.'
          : 'No se ha podido abrir los mensajes. Prueba con WhatsApp.',
      );
    } finally {
      setPreparando(undefined);
    }
  };

  return (
    <PantallaFormulario
      titulo="Emergencia"
      subtitulo="Si estás en peligro o alguien necesita ayuda, llama primero.">
      <Presionable
        accessibilityLabel="Llamar al 112"
        accessibilityHint="Abre el teléfono con el número de emergencias"
        onPress={llamar}
        style={estilos.llamar}>
        <Text style={estilos.numero}>112</Text>
        <View style={estilos.textosLlamar}>
          <Text style={estilos.tituloLlamar}>Llamar a emergencias</Text>
          <Text style={estilos.detalleLlamar}>Gratis, en toda España y Portugal.</Text>
        </View>
      </Presionable>

      {!listo ? null : contacto ? (
        <Seccion
          titulo={`Avisar a ${contacto.nombre}`}
          descripcion="Se abre el mensaje ya escrito, con tu ubicación de este momento. Tú lo envías.">
          <Boton
            titulo="Avisar por WhatsApp"
            onPress={() => avisar('whatsapp')}
            cargando={preparando === 'whatsapp'}
            deshabilitado={preparando === 'sms'}
          />
          <Boton
            titulo="Avisar por SMS"
            variante="secundario"
            onPress={() => avisar('sms')}
            cargando={preparando === 'sms'}
            deshabilitado={preparando === 'whatsapp'}
          />
          {preparando ? (
            <View style={estilos.buscando} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" />
              <Texto variante="detalle" color="textoSecundario">
                Buscando tu ubicación…
              </Texto>
            </View>
          ) : null}
          <Boton
            titulo="Cambiar contacto"
            variante="secundario"
            compacto
            onPress={() => router.push('/contacto-confianza')}
          />
        </Seccion>
      ) : (
        <Seccion
          titulo="Contacto de confianza"
          descripcion="Elige a alguien a quien avisar con tu ubicación en un toque. Hazlo ahora, antes de necesitarlo.">
          <Boton
            titulo="Añadir contacto de confianza"
            onPress={() => router.push('/contacto-confianza')}
          />
        </Seccion>
      )}

      {fallo ? (
        <Texto variante="detalle" color="error" accessibilityLiveRegion="assertive">
          {fallo}
        </Texto>
      ) : null}

      <Texto variante="detalle" color="textoSecundario">
        Tu ubicación solo viaja dentro de ese mensaje. Planeo no la guarda ni la comparte con nadie
        más.
      </Texto>
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  llamar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: 96,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
    borderRadius: radio.l,
    backgroundColor: ROJO_EMERGENCIA,
  },
  numero: {
    fontFamily: fuentes.titular,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    color: '#FFFFFF',
  },
  textosLlamar: { flex: 1, gap: 2 },
  tituloLlamar: { fontFamily: fuentes.titulo, fontSize: 19, lineHeight: 24, color: '#FFFFFF' },
  detalleLlamar: { fontFamily: fuentes.textoMedio, fontSize: 14, lineHeight: 20, color: '#FFE4DE' },
  buscando: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
});
