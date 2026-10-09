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
const CLAVE_MINIMA = 8;

/**
 * Recuperar la contraseña en dos pasos, sin salir de la app: se pide un código por
 * correo y, con él, se elige la contraseña nueva. Igual que el registro, usa un código
 * de 6 dígitos en vez de un enlace.
 */
export default function PantallaRecuperar() {
  const parametros = useLocalSearchParams<{ correo?: string }>();
  const [correo, setCorreo] = useState(parametros.correo ?? '');
  const [enviado, setEnviado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string>();
  const [cargando, setCargando] = useState(false);

  const email = correo.trim().toLowerCase();

  const pedirCodigo = async () => {
    setError(undefined);
    setCargando(true);
    const { error: fallo } = await supabase.auth.resetPasswordForEmail(email);
    setCargando(false);
    if (fallo) setError(mensajeDeError(fallo));
    else setEnviado(true);
  };

  const cambiar = async () => {
    setError(undefined);
    setCargando(true);
    // El código inicia sesión; con la sesión abierta ya se puede cambiar la contraseña.
    const verificacion = await supabase.auth.verifyOtp({
      email,
      token: codigo,
      type: 'recovery',
    });
    if (verificacion.error) {
      setCargando(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(mensajeDeError(verificacion.error));
      return;
    }
    const cambio = await supabase.auth.updateUser({ password: clave });
    setCargando(false);
    if (cambio.error) {
      setError(mensajeDeError(cambio.error));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissTo('/perfil');
  };

  if (!enviado) {
    return (
      <PantallaFormulario
        titulo="Recuperar contraseña"
        subtitulo="Te enviamos un código para elegir una nueva.">
        <CampoTexto
          etiqueta="Correo electrónico"
          value={correo}
          onChangeText={setCorreo}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={pedirCodigo}
          error={error}
        />
        <Boton
          titulo="Enviar código"
          onPress={pedirCodigo}
          cargando={cargando}
          deshabilitado={!correo.includes('@')}
        />
      </PantallaFormulario>
    );
  }

  return (
    <PantallaFormulario
      titulo="Nueva contraseña"
      subtitulo={`Si ${email} tiene cuenta, le ha llegado un código.`}>
      <CampoTexto
        etiqueta="Código"
        value={codigo}
        onChangeText={(texto) => setCodigo(texto.replace(/\D/g, '').slice(0, LARGO_CODIGO))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={LARGO_CODIGO}
        autoFocus
        style={estilos.codigo}
      />
      <CampoTexto
        etiqueta="Contraseña nueva"
        ayuda={`Al menos ${CLAVE_MINIMA} caracteres.`}
        value={clave}
        onChangeText={setClave}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={error}
      />
      <Boton
        titulo="Cambiar contraseña"
        onPress={cambiar}
        cargando={cargando}
        deshabilitado={codigo.length !== LARGO_CODIGO || clave.length < CLAVE_MINIMA}
      />
      <Texto variante="detalle" color="textoSecundario" style={estilos.centrado}>
        ¿No te llega? Revisa el correo no deseado o pide otro.
      </Texto>
      <Boton titulo="Enviar otro código" variante="secundario" onPress={pedirCodigo} />
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  codigo: {
    fontFamily: fuentes.titulo,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
  },
  centrado: { textAlign: 'center' },
});
