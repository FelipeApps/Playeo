import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';

import { Boton } from '@/components/boton';
import { Casilla } from '@/components/casilla';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import { mensajeDeError, supabase } from '@/lib/supabase';

/**
 * Confirmación de la mayoría de edad para cuentas que no pasaron por el formulario de
 * registro (las que entran con Google o Apple). Sin ella, la base de datos no deja
 * añadir amigos, escribir ni crear quedadas.
 */
export default function PantallaEdad() {
  const consultas = useQueryClient();
  const [adulto, setAdulto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string>();

  const confirmar = async () => {
    setError(undefined);
    setCargando(true);
    const { error: fallo } = await supabase.rpc('confirmar_mayoria_edad');
    setCargando(false);
    if (fallo) {
      setError(mensajeDeError(fallo));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await consultas.invalidateQueries({ queryKey: ['social', 'perfil'] });
    router.replace('/perfil');
  };

  return (
    <PantallaFormulario titulo="Una cosa más" subtitulo="Planeo es solo para mayores de edad.">
      <Texto>
        Para añadir amigos, chatear y organizar quedadas necesitamos que confirmes tu edad. No
        guardamos tu fecha de nacimiento, solo que lo has confirmado.
      </Texto>
      <Casilla
        marcada={adulto}
        alCambiar={setAdulto}
        etiqueta="Confirmo que tengo 18 años o más."
      />
      {error ? (
        <Texto variante="detalle" color="error" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : null}
      <Boton titulo="Continuar" onPress={confirmar} cargando={cargando} deshabilitado={!adulto} />
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
