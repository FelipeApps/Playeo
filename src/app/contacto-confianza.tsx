import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Texto } from '@/components/texto';
import {
  normalizarTelefono,
  useContactoConfianza,
  type ContactoConfianza,
} from '@/seguridad/contacto';

function Formulario({ inicial }: { inicial: ContactoConfianza | null }) {
  const { guardar, quitar } = useContactoConfianza();
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [telefono, setTelefono] = useState(inicial?.telefono ?? '');
  const [errorTelefono, setErrorTelefono] = useState<string>();

  const enviar = () => {
    const normalizado = normalizarTelefono(telefono);
    if (!normalizado) {
      setErrorTelefono('Escribe un teléfono válido. Si no es español, con su prefijo: +351…');
      return;
    }
    guardar({ nombre: nombre.trim(), telefono: normalizado });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <>
      <CampoTexto
        etiqueta="Nombre"
        value={nombre}
        onChangeText={setNombre}
        maxLength={40}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="next"
      />
      <CampoTexto
        etiqueta="Teléfono"
        ayuda="Sin prefijo se entiende que es de España (+34)."
        value={telefono}
        onChangeText={(texto) => {
          setTelefono(texto);
          setErrorTelefono(undefined);
        }}
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={20}
        error={errorTelefono}
      />
      <Boton
        titulo="Guardar contacto"
        onPress={enviar}
        deshabilitado={nombre.trim().length === 0 || telefono.trim().length === 0}
      />
      {inicial ? (
        <Boton
          titulo="Quitar contacto"
          variante="peligro"
          onPress={() => {
            quitar();
            router.back();
          }}
        />
      ) : null}
      <Texto variante="detalle" color="textoSecundario">
        Se guarda solo en este móvil. Avísale de que le has elegido, para que sepa qué hacer si le
        llega tu mensaje.
      </Texto>
    </>
  );
}

export default function PantallaContactoConfianza() {
  const { contacto, listo } = useContactoConfianza();

  return (
    <PantallaFormulario
      titulo="Contacto de confianza"
      subtitulo="La persona a la que avisas desde el botón SOS.">
      {listo ? <Formulario inicial={contacto} /> : null}
    </PantallaFormulario>
  );
}
