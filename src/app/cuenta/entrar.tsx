import { router } from 'expo-router';
import { useState } from 'react';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import { mensajeDeError, supabase } from '@/lib/supabase';
import { BotonGoogle } from '@/sesion/google';

export default function PantallaEntrar() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string>();
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    setError(undefined);
    setCargando(true);
    const email = correo.trim().toLowerCase();
    const { error: fallo } = await supabase.auth.signInWithPassword({ email, password: clave });
    setCargando(false);

    if (!fallo) {
      router.dismissTo('/perfil');
    } else if (fallo.code === 'email_not_confirmed') {
      // La cuenta existe pero falta el código: se reenvía y se pide.
      await supabase.auth.resend({ type: 'signup', email });
      router.push({ pathname: '/cuenta/verificar', params: { correo: email } });
    } else {
      setError(mensajeDeError(fallo));
    }
  };

  return (
    <PantallaFormulario titulo="Entrar" subtitulo="Con el correo y la contraseña de tu cuenta.">
      <CampoTexto
        etiqueta="Correo electrónico"
        value={correo}
        onChangeText={setCorreo}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <CampoTexto
        etiqueta="Contraseña"
        value={clave}
        onChangeText={setClave}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={entrar}
        error={error}
      />
      <Boton
        titulo="Entrar"
        onPress={entrar}
        cargando={cargando}
        deshabilitado={!correo.includes('@') || clave.length === 0}
      />
      <BotonGoogle />
      <Boton
        titulo="He olvidado mi contraseña"
        variante="secundario"
        onPress={() =>
          router.push({ pathname: '/cuenta/recuperar', params: { correo: correo.trim() } })
        }
      />
      <Texto variante="detalle" color="textoSecundario" style={{ textAlign: 'center' }}>
        ¿Aún no tienes cuenta?
      </Texto>
      <Boton
        titulo="Crear cuenta"
        variante="secundario"
        onPress={() => router.replace('/cuenta/registro')}
      />
    </PantallaFormulario>
  );
}
