import { StyleSheet, View } from 'react-native';

import { Boton } from '@/components/boton';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { FilaUsuario } from '@/components/fila-usuario';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { useAccionesSociales, useBloqueados } from '@/social/amigos';
import { espacio, radio } from '@/theme';

export default function PantallaBloqueados() {
  const bloqueados = useBloqueados();
  const { desbloquear } = useAccionesSociales();

  let contenido;
  if (bloqueados.isPending) {
    contenido = <Esqueleto alto={74} redondeo={radio.l} />;
  } else if (bloqueados.isError) {
    contenido = (
      <EstadoVacio
        escena="sin-conexion"
        titulo="No se pudo cargar la lista"
        mensaje="Comprueba que tienes conexión con el servidor y vuelve a intentarlo.">
        <Boton titulo="Reintentar" onPress={() => bloqueados.refetch()} />
      </EstadoVacio>
    );
  } else if (bloqueados.data.length === 0) {
    contenido = (
      <EstadoVacio
        escena="vacio"
        titulo="No has bloqueado a nadie"
        mensaje="Si alguien te molesta, puedes bloquearle desde su ficha."
      />
    );
  } else {
    contenido = (
      <View style={estilos.lista}>
        {bloqueados.data.map((usuario) => (
          <FilaUsuario key={usuario.id} usuario={usuario} abreFicha={false}>
            <Boton
              compacto
              titulo="Desbloquear"
              variante="secundario"
              cargando={desbloquear.isPending && desbloquear.variables === usuario.id}
              onPress={() => desbloquear.mutate(usuario.id)}
            />
          </FilaUsuario>
        ))}
      </View>
    );
  }

  return (
    <PantallaFormulario
      titulo="Personas bloqueadas"
      subtitulo="No ven tu perfil ni pueden escribirte.">
      {contenido}
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.xs },
});
