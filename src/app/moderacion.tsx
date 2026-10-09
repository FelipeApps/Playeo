import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Boton } from '@/components/boton';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Segmentado } from '@/components/segmentado';
import { Texto } from '@/components/texto';
import type { Database } from '@/lib/database.types';
import { mensajeDeError, supabase } from '@/lib/supabase';
import { momentoCorto } from '@/social/chat';
import { espacio, radio, sombra, useTema } from '@/theme';

type EstadoReporte = Database['public']['Enums']['estado_reporte'];
type Motivo = Database['public']['Enums']['motivo_reporte'];

const MOTIVOS: Record<Motivo, string> = {
  acoso: 'Acoso o amenazas',
  contenido_inapropiado: 'Contenido inapropiado',
  spam: 'Spam o publicidad',
  suplantacion: 'Suplantación',
  otro: 'Otro motivo',
};

const VISTAS = [
  { valor: 'abiertos', etiqueta: 'Por revisar' },
  { valor: 'todos', etiqueta: 'Todos' },
] as const;

/** Cola de reportes. Solo la ven quienes están en la lista de moderadores. */
export default function PantallaModeracion() {
  const { colores, esOscuro } = useTema();
  const consultas = useQueryClient();
  const [vista, setVista] = useState<'abiertos' | 'todos'>('abiertos');

  const reportes = useQuery({
    queryKey: ['social', 'moderacion', vista],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('reportes_para_moderar', {
        solo_abiertos: vista === 'abiertos',
      });
      if (error) throw error;
      return data;
    },
  });

  const alTerminar = () => consultas.invalidateQueries({ queryKey: ['social', 'moderacion'] });
  const avisar = (fallo: unknown) => Alert.alert('No se pudo completar', mensajeDeError(fallo));

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: number; estado: EstadoReporte }) => {
      const { error } = await supabase.from('reportes').update({ estado }).eq('id', id);
      if (error) throw error;
    },
    onError: avisar,
    onSettled: alTerminar,
  });

  const retirarMensaje = useMutation({
    mutationFn: async (reporte: number) => {
      const { error } = await supabase.rpc('moderar_borrar_mensaje', { reporte });
      if (error) throw error;
    },
    onError: avisar,
    onSettled: alTerminar,
  });

  const confirmarRetirada = (id: number) =>
    Alert.alert('Retirar el mensaje', 'Se borrará del chat para todos. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Retirar', style: 'destructive', onPress: () => retirarMensaje.mutate(id) },
    ]);

  let contenido;
  if (reportes.isPending) {
    contenido = <Esqueleto alto={170} redondeo={radio.l} />;
  } else if (reportes.isError) {
    contenido = (
      <EstadoVacio
        escena="sin-conexion"
        titulo="No se pudieron cargar los reportes"
        mensaje="Comprueba que tienes conexión con el servidor y vuelve a intentarlo.">
        <Boton titulo="Reintentar" onPress={() => reportes.refetch()} />
      </EstadoVacio>
    );
  } else if (reportes.data.length === 0) {
    contenido = (
      <EstadoVacio
        escena="vacio"
        titulo={vista === 'abiertos' ? 'Nada por revisar' : 'Aún no hay reportes'}
        mensaje="Cuando alguien reporte a un usuario o un mensaje, aparecerá aquí."
      />
    );
  } else {
    contenido = reportes.data.map((reporte) => (
      <View
        key={reporte.id}
        style={[
          estilos.tarjeta,
          sombra(esOscuro),
          { backgroundColor: colores.superficie, borderColor: colores.borde },
        ]}>
        <View style={estilos.linea}>
          <Texto variante="subtitulo" style={estilos.flexible}>
            {MOTIVOS[reporte.motivo]}
          </Texto>
          <Texto variante="etiqueta" color="textoSecundario">
            {momentoCorto(reporte.creado)}
          </Texto>
        </View>
        <Texto variante="detalle" color="textoSecundario">
          {reporte.reportante_nombre ?? 'Cuenta eliminada'} reporta a{' '}
          {reporte.reportado_nombre
            ? `${reporte.reportado_nombre} (@${reporte.reportado_usuario})`
            : 'una cuenta eliminada'}
          .
          {reporte.reportes_previos > 0
            ? ` Tiene ${reporte.reportes_previos} ${reporte.reportes_previos === 1 ? 'reporte más' : 'reportes más'}.`
            : ''}
        </Texto>

        {reporte.contenido ? (
          <View style={[estilos.cita, { backgroundColor: colores.arena }]}>
            <Texto variante="etiqueta" color="sobreArena">
              {reporte.mensaje_existe ? 'Mensaje reportado' : 'Mensaje reportado (ya no existe)'}
            </Texto>
            <Texto color="sobreArena">{reporte.contenido}</Texto>
          </View>
        ) : null}
        {reporte.detalles ? <Texto>{reporte.detalles}</Texto> : null}

        {reporte.estado === 'abierto' ? (
          <View style={estilos.acciones}>
            {reporte.mensaje_existe ? (
              <Boton
                compacto
                titulo="Retirar mensaje"
                variante="peligro"
                onPress={() => confirmarRetirada(reporte.id)}
              />
            ) : null}
            {reporte.reportado_id ? (
              <Boton
                compacto
                titulo="Ver perfil"
                variante="secundario"
                onPress={() =>
                  router.push({
                    pathname: '/usuario/[id]',
                    params: { id: reporte.reportado_id ?? '' },
                  })
                }
              />
            ) : null}
            <Boton
              compacto
              titulo="Sin infracción"
              variante="secundario"
              onPress={() => cambiarEstado.mutate({ id: reporte.id, estado: 'cerrado' })}
            />
            <Boton
              compacto
              titulo="Revisado"
              onPress={() => cambiarEstado.mutate({ id: reporte.id, estado: 'revisado' })}
            />
          </View>
        ) : (
          <Texto variante="etiqueta" color="textoSecundario">
            {reporte.estado === 'revisado' ? 'Revisado' : 'Cerrado sin infracción'}
          </Texto>
        )}
      </View>
    ));
  }

  return (
    <PantallaFormulario titulo="Moderación" subtitulo="Reportes de usuarios y mensajes.">
      <Segmentado
        etiqueta="Qué reportes ver"
        opciones={VISTAS}
        valor={vista}
        alCambiar={setVista}
      />
      {contenido}
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    padding: espacio.m,
    gap: espacio.s,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  linea: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.s },
  flexible: { flex: 1 },
  cita: { padding: espacio.s, gap: espacio.xxs, borderRadius: radio.m },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs },
});
