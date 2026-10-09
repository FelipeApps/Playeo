import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import { mensajeDeError } from '@/lib/supabase';
import { useAccionesSociales, type MotivoReporte } from '@/social/amigos';
import { espacio, radio, useTema } from '@/theme';

const MOTIVOS: { valor: MotivoReporte; etiqueta: string }[] = [
  { valor: 'acoso', etiqueta: 'Acoso o amenazas' },
  { valor: 'contenido_inapropiado', etiqueta: 'Contenido inapropiado' },
  { valor: 'spam', etiqueta: 'Spam o publicidad' },
  { valor: 'suplantacion', etiqueta: 'Se hace pasar por otra persona' },
  { valor: 'otro', etiqueta: 'Otro motivo' },
];

const DETALLES_MAXIMOS = 500;

export default function PantallaReportar() {
  const { usuario, nombre, mensaje, contenido } = useLocalSearchParams<{
    usuario: string;
    nombre: string;
    /** Presentes cuando se reporta un mensaje concreto del chat. */
    mensaje?: string;
    contenido?: string;
  }>();
  const { colores } = useTema();
  const { reportar } = useAccionesSociales();
  const [motivo, setMotivo] = useState<MotivoReporte>();
  const [detalles, setDetalles] = useState('');
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <PantallaFormulario titulo="Reporte enviado">
        <Texto>
          Gracias por avisar. Revisaremos lo ocurrido. Si no quieres volver a saber de {nombre},
          puedes bloquear su perfil.
        </Texto>
        <Boton titulo="Volver" onPress={() => router.back()} />
      </PantallaFormulario>
    );
  }

  const enviar = () => {
    if (!motivo) return;
    reportar.mutate(
      { usuario, motivo, detalles, mensaje: mensaje ? Number(mensaje) : undefined, contenido },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setEnviado(true);
        },
      },
    );
  };

  return (
    <PantallaFormulario
      titulo={mensaje ? 'Reportar mensaje' : `Reportar a ${nombre}`}
      subtitulo="No sabrá que le has reportado.">
      {contenido ? (
        <View style={[estilos.cita, { backgroundColor: colores.arena }]}>
          <Texto variante="etiqueta" color="sobreArena">
            Mensaje de {nombre}
          </Texto>
          <Texto color="sobreArena" numberOfLines={4}>
            {contenido}
          </Texto>
        </View>
      ) : null}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Motivo del reporte"
        style={estilos.lista}>
        {MOTIVOS.map((opcion) => {
          const activo = opcion.valor === motivo;
          return (
            <Pressable
              key={opcion.valor}
              accessibilityRole="radio"
              accessibilityState={{ checked: activo }}
              onPress={() => {
                Haptics.selectionAsync();
                setMotivo(opcion.valor);
              }}
              style={[
                estilos.opcion,
                {
                  backgroundColor: colores.superficie,
                  borderColor: activo ? colores.primario : colores.borde,
                  borderWidth: activo ? 2 : 1,
                },
              ]}>
              <View
                style={[
                  estilos.circulo,
                  { borderColor: activo ? colores.primario : colores.textoSecundario },
                ]}>
                {activo ? (
                  <View style={[estilos.punto, { backgroundColor: colores.primario }]} />
                ) : null}
              </View>
              <Texto style={estilos.flexible}>{opcion.etiqueta}</Texto>
            </Pressable>
          );
        })}
      </View>

      <CampoTexto
        etiqueta="Cuéntanos qué ha pasado (opcional)"
        ayuda={`${detalles.length} de ${DETALLES_MAXIMOS} caracteres.`}
        value={detalles}
        onChangeText={setDetalles}
        maxLength={DETALLES_MAXIMOS}
        multiline
        style={estilos.detalles}
        error={reportar.isError ? mensajeDeError(reportar.error) : undefined}
      />

      <Boton
        titulo="Enviar reporte"
        onPress={enviar}
        cargando={reportar.isPending}
        deshabilitado={!motivo}
      />
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.xs },
  cita: { padding: espacio.m, gap: espacio.xxs, borderRadius: radio.m },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    minHeight: 56,
    paddingHorizontal: espacio.m,
    borderRadius: radio.m,
  },
  circulo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  punto: { width: 10, height: 10, borderRadius: 5 },
  flexible: { flex: 1 },
  detalles: { minHeight: 110, textAlignVertical: 'top' },
});
