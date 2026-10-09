import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoFechaHora } from '@/components/campo-fecha-hora';
import { CampoTexto } from '@/components/campo-texto';
import { Esqueleto } from '@/components/esqueleto';
import { FotoPlaya } from '@/components/foto-playa';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Presionable } from '@/components/presionable';
import { Segmentado } from '@/components/segmentado';
import { SelectorActividad } from '@/components/selector-actividad';
import { Texto } from '@/components/texto';
import { ACTIVIDADES, buscarActividad, type IdActividad } from '@/data/actividades';
import { buscarPlaya, playasDe } from '@/data/playas';
import { mensajeDeError } from '@/lib/supabase';
import { useRegion } from '@/region/contexto';
import { etiquetaVisibilidad, useAccionesEvento, type Visibilidad } from '@/social/eventos';
import { ENLACE_WHATSAPP, useMisGrupos } from '@/social/grupos';
import { descripcionDe, useLugar, useLugares } from '@/social/lugares';
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
/** Lugares del catálogo que se ofrecen de una vez; con más, se afina escribiendo. */
const LUGARES_VISIBLES = 8;

/** Mañana a las 11:00: un punto de partida razonable para un plan. */
function manana(): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  fecha.setHours(11, 0, 0, 0);
  return fecha;
}

/** Carrusel de playas con foto. */
function SelectorPlaya({
  region,
  valor,
  alCambiar,
}: {
  region: string;
  valor: string | undefined;
  alCambiar: (id: string) => void;
}) {
  const { colores } = useTema();
  const playas = playasDe(region);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.playas}
      accessibilityRole="radiogroup"
      accessibilityLabel="Playa de la quedada">
      {playas.map((playa) => {
        const activa = playa.id === valor;
        return (
          <Presionable
            key={playa.id}
            accessibilityRole="radio"
            accessibilityLabel={playa.nombre}
            accessibilityState={{ checked: activa }}
            onPress={() => {
              Haptics.selectionAsync();
              alCambiar(playa.id);
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
  );
}

/** Buscador de rutas o canchas del catálogo de la zona. */
function SelectorLugar({
  actividad,
  region,
  valor,
  alCambiar,
}: {
  actividad: IdActividad;
  region: string;
  valor: string | undefined;
  alCambiar: (id: string) => void;
}) {
  const { colores } = useTema();
  const [texto, setTexto] = useState('');
  const lugares = useLugares(actividad, region);
  // Si se llega con un lugar ya elegido (desde su ficha), puede no estar entre los primeros.
  const { data: elegido } = useLugar(valor);
  const { lugares: comoSeLlaman } = buscarActividad(actividad);

  if (lugares.isPending) return <Esqueleto alto={64} redondeo={radio.m} />;
  if (lugares.isError || lugares.data.length === 0) {
    return (
      <Texto variante="detalle" color="error">
        {lugares.isError
          ? 'No se pudo cargar el catálogo. Comprueba la conexión.'
          : `Aún no hay ${comoSeLlaman} del catálogo en tu zona. Usa la actividad «Otros» para escribir el sitio a mano.`}
      </Texto>
    );
  }

  const busqueda = texto.trim().toLowerCase();
  const coinciden = lugares.data.filter(
    (lugar) =>
      !busqueda ||
      lugar.nombre.toLowerCase().includes(busqueda) ||
      lugar.datos.cerca_de?.toLowerCase().includes(busqueda),
  );
  const visibles = coinciden.slice(0, LUGARES_VISIBLES);
  // El elegido se enseña siempre, aunque el filtro lo haya dejado fuera.
  const lista =
    elegido && !visibles.some((lugar) => lugar.id === elegido.id)
      ? [elegido, ...visibles]
      : visibles;

  return (
    <>
      <CampoTexto
        etiqueta={`Buscar entre ${lugares.data.length} ${comoSeLlaman}`}
        value={texto}
        onChangeText={setTexto}
        autoCorrect={false}
        ayuda="Por nombre o por pueblo."
      />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Lugar de la quedada"
        style={estilos.lugares}>
        {lista.map((lugar) => {
          const activo = lugar.id === valor;
          return (
            <Presionable
              key={lugar.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: activo }}
              onPress={() => {
                Haptics.selectionAsync();
                alCambiar(lugar.id);
              }}
              style={[
                estilos.lugar,
                {
                  backgroundColor: colores.superficie,
                  borderColor: activo ? colores.primario : colores.borde,
                  borderWidth: activo ? 2 : 1,
                },
              ]}>
              <Texto variante="cuerpoFuerte" numberOfLines={1}>
                {lugar.nombre}
              </Texto>
              {descripcionDe(lugar) ? (
                <Texto variante="etiqueta" color="textoSecundario" numberOfLines={1}>
                  {descripcionDe(lugar)}
                </Texto>
              ) : null}
            </Presionable>
          );
        })}
      </View>
      {coinciden.length > LUGARES_VISIBLES ? (
        <Texto variante="etiqueta" color="textoSecundario">
          Hay {coinciden.length - LUGARES_VISIBLES} más: escribe para encontrarlos.
        </Texto>
      ) : null}
    </>
  );
}

export default function PantallaNuevoEvento() {
  const parametros = useLocalSearchParams<{
    actividad?: IdActividad;
    lugar?: string;
    playa?: string;
  }>();
  const { colores } = useTema();
  const { zona } = useRegion();
  const { data: grupos } = useMisGrupos();
  const { crear } = useAccionesEvento();

  // Si se llega desde una playa de otra zona, se ofrecen las de esa zona.
  const playaInicial = parametros.playa ? buscarPlaya(parametros.playa) : undefined;
  const region = playaInicial?.region ?? zona?.id ?? '';

  const [actividadId, setActividadId] = useState<IdActividad>(parametros.actividad ?? 'playa');
  const [lugarId, setLugarId] = useState(playaInicial?.id ?? parametros.lugar);
  const [actividadOtra, setActividadOtra] = useState('');
  const [sitio, setSitio] = useState('');
  const [direccion, setDireccion] = useState('');
  const [titulo, setTitulo] = useState('');
  const [empieza, setEmpieza] = useState(manana);
  const [descripcion, setDescripcion] = useState('');
  const [plazas, setPlazas] = useState('');
  const [visibilidad, setVisibilidad] = useState<Visibilidad>('amigos');
  const [grupoId, setGrupoId] = useState<string>();
  const [enlace, setEnlace] = useState('');
  const [ahora] = useState(() => new Date());

  const actividad = buscarActividad(actividadId);
  const esManual = actividad.tipoSitio === 'manual';

  const cambiarActividad = (nueva: IdActividad) => {
    setActividadId(nueva);
    // Un lugar de otra actividad ya no vale.
    setLugarId(undefined);
  };

  const numeroPlazas = plazas.trim() === '' ? null : Number(plazas);
  const plazasValidas =
    numeroPlazas == null ||
    (Number.isInteger(numeroPlazas) && numeroPlazas >= 2 && numeroPlazas <= 500);
  const enlaceLimpio = enlace.trim();
  const enlaceValido = enlaceLimpio === '' || ENLACE_WHATSAPP.test(enlaceLimpio);
  const sitioCompleto = esManual
    ? sitio.trim().length >= 2 && (actividadId !== 'otros' || actividadOtra.trim().length >= 2)
    : lugarId != null;
  const completo =
    sitioCompleto &&
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
    crear.mutate(
      {
        actividad_id: actividadId,
        actividad_otra: actividadId === 'otros' ? actividadOtra.trim() : null,
        lugar_id: esManual ? null : (lugarId ?? null),
        ubicacion_nombre: esManual ? sitio.trim() : null,
        ubicacion_direccion: esManual ? direccion.trim() || null : null,
        region: region || null,
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
    <PantallaFormulario titulo="Crear una quedada" subtitulo="Qué, dónde y cuándo.">
      <View style={estilos.bloque}>
        <Texto variante="etiqueta" color="textoSecundario">
          Qué vais a hacer: {actividad.nombre.toLowerCase()}
        </Texto>
        <View style={estilos.aSangre}>
          <SelectorActividad
            actividades={ACTIVIDADES}
            valor={actividadId}
            alCambiar={cambiarActividad}
          />
        </View>
        {actividadId === 'otros' ? (
          <CampoTexto
            etiqueta="Qué actividad"
            ayuda="Por ejemplo, Yoga, Volley playa o Paseo en bici."
            value={actividadOtra}
            onChangeText={setActividadOtra}
            maxLength={60}
          />
        ) : null}
      </View>

      <View style={estilos.bloque}>
        <Texto variante="etiqueta" color="textoSecundario">
          Dónde
        </Texto>
        {actividadId === 'playa' ? (
          <SelectorPlaya region={region} valor={lugarId} alCambiar={setLugarId} />
        ) : esManual ? (
          <>
            <CampoTexto
              etiqueta="Nombre del sitio"
              ayuda="Lo verá todo el que pueda ver la quedada. Por ejemplo, Estudio Mar o Parque Doramas."
              value={sitio}
              onChangeText={setSitio}
              maxLength={120}
            />
            <CampoTexto
              etiqueta="Dirección exacta (opcional)"
              ayuda="Solo la verá quien se apunte."
              value={direccion}
              onChangeText={setDireccion}
              maxLength={300}
            />
          </>
        ) : (
          <SelectorLugar
            key={actividadId}
            actividad={actividadId}
            region={region}
            valor={lugarId}
            alCambiar={setLugarId}
          />
        )}
      </View>

      <CampoTexto
        etiqueta="Título"
        ayuda="Por ejemplo, Baño al atardecer o Pachanga del jueves."
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
  // El selector de actividad se desliza de borde a borde, por fuera del margen del formulario.
  aSangre: { marginHorizontal: -espacio.l },
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
  lugares: { gap: espacio.xs },
  lugar: {
    minHeight: 56,
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.xs,
    borderRadius: radio.m,
  },
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
