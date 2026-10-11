import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';

import { AceptacionCondiciones } from '@/components/aceptacion-condiciones';
import { Boton } from '@/components/boton';
import { Casilla } from '@/components/casilla';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import { VERSION_CONDICIONES } from '@/data/textos-legales';
import { mensajeDeError, supabase } from '@/lib/supabase';
import { olvidarCondiciones, useCondicionesAceptadas } from '@/sesion/condiciones';

/**
 * Lo que falta por confirmar a las cuentas que no pasaron por el formulario de registro
 * (las que entran con Google o Apple): la mayoría de edad y la aceptación de las
 * condiciones. Sin la primera, la base de datos no deja añadir amigos, escribir ni crear
 * quedadas. También se llega aquí cuando se publica una versión nueva de las condiciones.
 */
export default function PantallaEdad() {
  const consultas = useQueryClient();
  const [adulto, setAdulto] = useState(false);
  const condiciones = useCondicionesAceptadas();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string>();

  const confirmar = async () => {
    setError(undefined);
    setCargando(true);
    // Las dos funciones no hacen nada si ya estaba confirmado, así que se llaman siempre.
    const { error: falloEdad } = await supabase.rpc('confirmar_mayoria_edad');
    const { error: falloCondiciones } = await supabase.rpc('aceptar_condiciones', {
      version: VERSION_CONDICIONES,
    });
    const fallo = falloEdad ?? falloCondiciones;
    setCargando(false);
    if (fallo) {
      setError(mensajeDeError(fallo));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    olvidarCondiciones();
    await consultas.invalidateQueries({ queryKey: ['social', 'perfil'] });
    router.replace('/perfil');
  };

  return (
    <PantallaFormulario titulo="Una cosa más" subtitulo="Planeo es solo para mayores de edad.">
      <Texto>
        Para añadir amigos, chatear y organizar quedadas necesitamos que confirmes tu edad y aceptes
        las condiciones. No guardamos tu fecha de nacimiento, solo que lo has confirmado.
      </Texto>
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
        titulo="Continuar"
        onPress={confirmar}
        cargando={cargando}
        deshabilitado={!adulto || !condiciones}
      />
      <Boton
        titulo="Cerrar sesión"
        variante="secundario"
        onPress={async () => {
          await supabase.auth.signOut();
          router.replace('/perfil');
        }}
      />
    </PantallaFormulario>
  );
}
