import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoFechaHora } from '@/components/campo-fecha-hora';
import { CampoTexto } from '@/components/campo-texto';
import { FotoPlaya } from '@/components/foto-playa';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Presionable } from '@/components/presionable';
import { Segmentado } from '@/components/segmentado';
import { Texto } from '@/components/texto';
import { buscarPlaya, playasDe } from '@/data/playas';
import { mensajeDeError } from '@/lib/supabase';
import { useRegion } from '@/region/contexto';
import { etiquetaVisibilidad, useAccionesEvento, type Visibilidad } from '@/social/eventos';
import { ENLACE_WHATSAPP, useMisGrupos } from '@/social/grupos';
import { espacio, fuentes, radio, useTema } from '@/theme';

const VISIBILIDADES: { valor: Visibilidad; etiqueta: string }[] = [
  { valor: 'amigos', etiqueta: etiquetaVisibilidad.amigos },
  { valor: 'grupo', etiqueta: etiquetaVisibilidad.grupo },
  { valor: 'publico', etiqueta: etiquetaVisibilidad.publico },
];

const AYUDA_VISIBILIDAD: Record<Visibilidad, string> = {
  amigos: 'La verán tus amigos y a quien invitéis.',
  grupo: 'La verán los miembros del grupo y a quien invitéis.',
  publico: 'La verá cualquier persona registrada.',
};

const DESCRIPCION_MAXIMA = 500;

/** Mañana a las 11:00: un punto de partida razonable para un plan de playa. */
function manana(): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  fecha.setHours(11, 0, 0, 0);
  return fecha;
}

export default function PantallaNuevoEvento() {
  const parametros = useLocalSearchParams<{ playa?: string }>();
  const { colores } = useTema();
  const { zona } = useRegion();
  const { data: grupos } = useMisGrupos();
  const { crear } = useAccionesEvento();

  // Si se llega desde el detalle de una playa de otra zona, se ofrecen las de esa zona.
  const preelegida = parametros.playa ? buscarPlaya(parametros.playa) : undefined;
  const playas = playasDe(preelegida?.region ?? zona?.id ?? '');

  const [playaId, setPlayaId] = useState(preelegida?.id);
  const [titulo, setTitulo] = useState('');
  const [empieza, setEmpieza] = useState(manana);
  const [descripcion, setDescripcion] = useState('');
  const [plazas, setPlazas] = useState('');
  const [visibilidad, setVisibilidad] = useState<Visibilidad>('amigos');
  const [grupoId, setGrupoId] = useState<string>();
  const [enlace, setEnlace] = useState('');
  const [ahora] = useState(() => new Date());

  const numeroPlazas = plazas.trim() === '' ? null : Number(plazas);
  const plazasValidas =
    numeroPlazas == null ||
    (Number.isInteger(numeroPlazas) && numeroPlazas >= 2 && numeroPlazas <= 500);
  const enlaceLimpio = enlace.trim();
  const enlaceValido = enlaceLimpio === '' || ENLACE_WHATSAPP.test(enlaceLimpio);
  const completo =
    playaId != null &&
    titulo.trim().length >= 3 &&
    empieza > ahora &&
    plazasValidas &&
    enlaceValido &&
    (visibilidad !== 'grupo' || grupoId != null);

  const elegirGrupo = (id: string) => {
    Haptics.selectionAsync();
    setGrupoId(id);
    // Si el grupo ya tiene su WhatsApp, se propone el mismo para la quedada.
    const delGrupo = grupos?.find((grupo) => grupo.id === id)?.enlace_whatsapp;
    if (delGrupo && enlace.trim() === '') setEnlace(delGrupo);
  };

  const guardar = () => {
    if (!playaId) return;
    crear.mutate(
      {
        playa_id: playaId,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        empieza: empieza.toISOString(),
        plazas_maximas: numeroPlazas,
        visibilidad,
        grupo_id: visibilidad === 'grupo' ? (grupoId ?? null) : null,
        enlace_whatsapp: enlaceLimpio || null,
      },
      {
        onSuccess: (id) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace({ pathname: '/evento/[id]', params: { id } });
        },
      },
    );
  };

  return (
    <PantallaFormulario titulo="Crear una quedada" subtitulo="El punto de encuentro es la playa.">
      <View style={estilos.bloque}>
        <Texto variante="etiqueta" color="textoSecundario">
          Playa
        </Texto>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={estilos.playas}
          accessibilityRole="radiogroup"
          accessibilityLabel="Playa de la quedada">
          {playas.map((playa) => {
            const activa = playa.id === playaId;
            return (
              <Presionable
                key={playa.id}
                accessibilityRole="radio"
                accessibilityLabel={playa.nombre}
                accessibilityState={{ checked: activa }}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPlayaId(playa.id);
                }}
                style={[estilos.playa, { borderColor: activa ? colores.sol : 'transparent' }]}>
                <FotoPlaya
                  playa={playa}
                  tamano="miniatura"
                  proporcion={1.3}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[StyleSheet.absoluteFill, estilos.velo]} />
                <Text style={estilos.nombrePlaya} numberOfLines={2}>
                  {playa.nombre}
                </Text>
              </Presionable>
            );
          })}
        </ScrollView>
      </View>

      <CampoTexto
        etiqueta="Título"
        ayuda="Por ejemplo, Baño al atardecer."
        value={titulo}
        onChangeText={setTitulo}
        maxLength={80}
      />
      <CampoFechaHora etiqueta="Cuándo" valor={empieza} alCambiar={setEmpieza} minimo={ahora} />
      <CampoTexto
        etiqueta="Descripción (opcional)"
        ayuda={`${descripcion.length} de ${DESCRIPCION_MAXIMA} caracteres.`}
        value={descripcion}
        onChangeText={setDescripcion}
        maxLength={DESCRIPCION_MAXIMA}
        multiline
        style={estilos.descripcion}
      />
      <CampoTexto
        etiqueta="Plazas (opcional)"
        ayuda="Contándote a ti. Déjalo vacío si no hay límite."
        value={plazas}
        onChangeText={(texto) => setPlazas(texto.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={3}
        error={plazasValidas ? undefined : 'Tiene que ser un número entre 2 y 500.'}
      />

      <View style={estilos.bloque}>
        <Texto variante="etiqueta" color="textoSecundario">
          Quién puede verla
        </Texto>
        <Segmentado
          etiqueta="Quién puede ver la quedada"
          opciones={VISIBILIDADES}
          valor={visibilidad}
          alCambiar={setVisibilidad}
        />
        <Texto variante="etiqueta" color="textoSecundario">
          {AYUDA_VISIBILIDAD[visibilidad]}
        </Texto>
        {visibilidad === 'grupo' ? (
          grupos && grupos.length > 0 ? (
            <View accessibilityRole="radiogroup" accessibilityLabel="Grupo" style={estilos.grupos}>
              {grupos.map((grupo) => {
                const activo = grupo.id === grupoId;
                return (
                  <Presionable
                    key={grupo.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: activo }}
                    onPress={() => elegirGrupo(grupo.id)}
                    style={[
                      estilos.chip,
                      {
                        backgroundColor: activo ? colores.primario : colores.superficie,
                        borderColor: activo ? colores.primario : colores.borde,
                      },
                    ]}>
                    <Texto variante="detalle" color={activo ? 'sobrePrimario' : 'texto'}>
                      {grupo.nombre}
                    </Texto>
                  </Presionable>
                );
              })}
            </View>
          ) : (
            <Texto variante="detalle" color="error">
              Aún no estás en ningún grupo. Crea uno o elige otra visibilidad.
            </Texto>
          )
        ) : null}
      </View>

      <CampoTexto
        etiqueta="Grupo de WhatsApp (opcional)"
        ayuda="Pega el enlace de invitación. Solo lo verá quien se apunte."
        placeholder="https://chat.whatsapp.com/…"
        value={enlace}
        onChangeText={setEnlace}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={
          enlaceValido
            ? undefined
            : 'Tiene que ser un enlace de invitación de WhatsApp: https://chat.whatsapp.com/…'
        }
      />

      {crear.isError ? (
        <Texto variante="detalle" color="error" accessibilityLiveRegion="polite">
          {mensajeDeError(crear.error)}
        </Texto>
      ) : null}
      <Boton
        titulo="Crear quedada"
        onPress={guardar}
        cargando={crear.isPending}
        deshabilitado={!completo}
      />
    </PantallaFormulario>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.xs },
  playas: { gap: espacio.xs },
  playa: {
    width: 132,
    height: 100,
    justifyContent: 'flex-end',
    padding: espacio.xs,
    borderRadius: radio.m,
    borderWidth: 3,
    overflow: 'hidden',
  },
  velo: { backgroundColor: 'rgba(4,20,30,0.38)' },
  nombrePlaya: { fontFamily: fuentes.textoFuerte, fontSize: 14, lineHeight: 17, color: '#FFFFFF' },
  descripcion: { minHeight: 96, textAlignVertical: 'top' },
  grupos: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: espacio.m,
    borderRadius: radio.completo,
    borderWidth: 1,
  },
});
