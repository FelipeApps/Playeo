import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import { mensajeDeError, supabase } from '@/lib/supabase';
import { fuentes } from '@/theme';

const LARGO_CODIGO = 6;

export default function PantallaVerificar() {
  const { correo } = useLocalSearchParams<{ correo: string }>();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [cargando, setCargando] = useState(false);

  const verificar = async (token: string) => {
    setError(undefined);
    setAviso(undefined);
    setCargando(true);
    const { error: fallo } = await supabase.auth.verifyOtp({
      email: correo,
      token,
      type: 'signup',
    });
    setCargando(false);

    if (fallo) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(mensajeDeError(fallo));
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissTo('/perfil');
    }
  };

  const reenviar = async () => {
    setError(undefined);
    const { error: fallo } = await supabase.auth.resend({ type: 'signup', email: correo });
    if (fallo) setError(mensajeDeError(fallo));
    else setAviso('Te hemos enviado un código nuevo.');
  };

  return (
    <PantallaFormulario
      titulo="Confirma tu correo"
      subtitulo={`Hemos enviado un código de ${LARGO_CODIGO} dígitos a ${correo}.`}>
      <CampoTexto
        etiqueta="Código"
        value={codigo}
        onChangeText={(texto) => {
          const limpio = texto.replace(/\D/g, '').slice(0, LARGO_CODIGO);
          setCodigo(limpio);
          // Con el código completo se verifica sin tener que pulsar el botón.
          if (limpio.length === LARGO_CODIGO && !cargando) verificar(limpio);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={LARGO_CODIGO}
        autoFocus
        error={error}
        ayuda={aviso}
        style={estilos.codigo}
      />
      <Boton
        titulo="Confirmar"
        onPress={() => verificar(codigo)}
        cargando={cargando}
        deshabilitado={codigo.length !== LARGO_CODIGO}
      />
      <Texto variante="detalle" color="textoSecundario" style={estilos.centrado}>
        ¿No te llega? Revisa el correo no deseado o pide otro.
      </Texto>
      <Boton titulo="Enviar otro código" variante="secundario" onPress={reenviar} />
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  codigo: { fontFamily: fuentes.titulo, fontSize: 28, letterSpacing: 8, textAlign: 'center' },
  centrado: { textAlign: 'center' },
});
