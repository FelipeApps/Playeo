import { router } from 'expo-router';
import { useState } from 'react';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { AceptacionCondiciones } from '@/components/aceptacion-condiciones';
import { Casilla } from '@/components/casilla';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import { mensajeDeError, supabase } from '@/lib/supabase';
import { BotonGoogle } from '@/sesion/google';
import { VERSION_CONDICIONES } from '@/data/textos-legales';
import { olvidarCondiciones, useCondicionesAceptadas } from '@/sesion/condiciones';

const FORMATO_USUARIO = /^[a-zA-Z0-9_.]{3,24}$/;
const CLAVE_MINIMA = 8;

export default function PantallaRegistro() {
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [adulto, setAdulto] = useState(false);
  const [errorUsuario, setErrorUsuario] = useState<string>();
  const [error, setError] = useState<string>();
  const [cargando, setCargando] = useState(false);

  const condiciones = useCondicionesAceptadas();

  const comprobarUsuario = async () => {
    if (usuario.length === 0) return true;
    if (!FORMATO_USUARIO.test(usuario)) {
      setErrorUsuario('De 3 a 24 caracteres: letras, números, punto o guion bajo.');
      return false;
    }
    const { data: libre } = await supabase.rpc('nombre_usuario_disponible', { nombre: usuario });
    if (libre === false) {
      setErrorUsuario('Ese nombre de usuario ya está cogido. Elige otro.');
      return false;
    }
    setErrorUsuario(undefined);
    return true;
  };

  const registrar = async () => {
    setError(undefined);
    setCargando(true);
    const email = correo.trim().toLowerCase();

    if (!(await comprobarUsuario())) {
      setCargando(false);
      return;
    }

    const { error: fallo } = await supabase.auth.signUp({
      email,
      password: clave,
      options: {
        // El trigger de la base de datos crea el perfil con estos datos y rechaza
        // el alta si falta la confirmación de edad.
        data: {
          nombre_usuario: usuario,
          nombre_visible: nombre.trim(),
          mayor_de_edad: adulto,
          // Solo se llega aquí tras leer y aceptar esta versión en el modal.
          condiciones_version: VERSION_CONDICIONES,
        },
      },
    });
    setCargando(false);

    if (fallo) setError(mensajeDeError(fallo));
    else {
      olvidarCondiciones();
      router.push({ pathname: '/cuenta/verificar', params: { correo: email } });
    }
  };

  const completo =
    nombre.trim().length > 0 &&
    FORMATO_USUARIO.test(usuario) &&
    correo.includes('@') &&
    clave.length >= CLAVE_MINIMA &&
    adulto &&
    condiciones;

  return (
    <PantallaFormulario titulo="Crear cuenta" subtitulo="Para quedar con tu gente.">
      <CampoTexto
        etiqueta="Nombre"
        ayuda="Como quieres que te vean los demás."
        value={nombre}
        onChangeText={setNombre}
        autoComplete="name"
        textContentType="name"
        maxLength={50}
        returnKeyType="next"
      />
      <CampoTexto
        etiqueta="Nombre de usuario"
        ayuda="Único. Con él te encuentran tus amigos."
        value={usuario}
        onChangeText={(texto) => {
          setUsuario(texto.trim());
          setErrorUsuario(undefined);
        }}
        onBlur={comprobarUsuario}
        error={errorUsuario}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        maxLength={24}
        returnKeyType="next"
      />
      <CampoTexto
        etiqueta="Correo electrónico"
        ayuda="Te enviaremos un código para confirmarlo."
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
        ayuda={`Al menos ${CLAVE_MINIMA} caracteres.`}
        value={clave}
        onChangeText={setClave}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
      />
      <Casilla
        marcada={adulto}
        alCambiar={setAdulto}
        etiqueta="Confirmo que tengo 18 años o más."
      />
      <AceptacionCondiciones />
      {error ? (
        <Texto variante="detalle" color="error" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : null}
      <Boton
        titulo="Crear cuenta"
        onPress={registrar}
        cargando={cargando}
        deshabilitado={!completo}
      />
      <BotonGoogle />
      <Boton
        titulo="Ya tengo cuenta"
        variante="secundario"
        onPress={() => router.replace('/cuenta/entrar')}
      />
    </PantallaFormulario>
  );
}
