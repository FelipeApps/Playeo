import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnilloPuntuacion } from '@/components/anillo-puntuacion';
import { Boton } from '@/components/boton';
import { CabeceraCielo } from '@/components/cabecera-cielo';
import { CampoTexto } from '@/components/campo-texto';
import { Esqueleto } from '@/components/esqueleto';
import { EstadoVacio } from '@/components/estado-vacio';
import { IlustracionActividad } from '@/components/ilustracion-actividad';
import { MapaLugares, type PuntoMapa } from '@/components/mapa-lugares';
import { ALTO_PESTANAS, useBarraEstado } from '@/components/pantalla';
import { Presionable } from '@/components/presionable';
import { RankingPlayas } from '@/components/ranking-playas';
import { Segmentado } from '@/components/segmentado';
import { SelectorActividad } from '@/components/selector-actividad';
import { Texto } from '@/components/texto';
import { ACTIVIDADES_CON_CATALOGO, buscarActividad, type IdActividad } from '@/data/actividades';
import { lugarDe } from '@/data/playas';
import { useRanking } from '@/hooks/use-ranking';
import { usePreferencias } from '@/preferencias/contexto';
import { useRegion } from '@/region/contexto';
import {
  descripcionDe,
  RUTAS_CON_ESTADO,
  useLugares,
  useRutasPuntuadas,
  type Lugar,
} from '@/social/lugares';
import { espacio, radio, sombra, useTema } from '@/theme';
import { resumenMonte } from '@/utils/resumen';

const VISTAS = [
  { valor: 'lista', etiqueta: 'Lista' },
  { valor: 'mapa', etiqueta: 'Mapa' },
] as const;
type Vista = (typeof VISTAS)[number]['valor'];

/** Canchas que se listan de una vez; con más, se afina con el buscador. */
const CANCHAS_VISIBLES = 60;

function abrirLugar(id: string) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  router.push({ pathname: '/lugar/[id]', params: { id } });
}

function filtrar(lugares: Lugar[], texto: string) {
  const busqueda = texto.trim().toLowerCase();
  if (!busqueda) return lugares;
  return lugares.filter(
    (lugar) =>
      lugar.nombre.toLowerCase().includes(busqueda) ||
      lugar.datos.cerca_de?.toLowerCase().includes(busqueda),
  );
}

/** Playas: el ranking del día o su mapa. */
function ExplorarPlayas({ vista, clave }: { vista: Vista; clave: string }) {
  const { ranking } = useRanking();

  if (vista === 'lista') return <RankingPlayas />;

  const puntos: PuntoMapa[] = ranking.map(({ playa, puntuacion }) => ({
    id: playa.id,
    nombre: playa.nombre,
    descripcion: lugarDe(playa),
    lat: playa.lat,
    lon: playa.lon,
    total: puntuacion.total,
  }));
  return (
    <MapaLugares
      puntos={puntos}
      clave={clave}
      alAbrir={(id) => router.push({ pathname: '/playa/[id]', params: { id } })}
    />
  );
}

/** Rutas de senderismo, ordenadas por cómo está el día en cada una. */
function ExplorarRutas({ vista, region, clave }: { vista: Vista; region: string; clave: string }) {
  const { colores, esOscuro } = useTema();
  const [texto, setTexto] = useState('');
  const lugares = useLugares('senderismo', region);
  const filtradas = filtrar(lugares.data ?? [], texto);
  const conEstado = filtradas.slice(0, RUTAS_CON_ESTADO);
  const { consulta, puntuadas } = useRutasPuntuadas(conEstado);

  if (lugares.isPending) return <Esqueleto alto={96} redondeo={radio.l} />;
  if (lugares.isError) return <SinCatalogo alReintentar={() => lugares.refetch()} />;
  if (lugares.data.length === 0) return <SinLugares actividad="senderismo" />;

  if (vista === 'mapa') {
    const totales = new Map(puntuadas.map((p) => [p.ruta.id, p.total]));
    const puntos: PuntoMapa[] = filtradas
      .filter((ruta) => ruta.lat != null && ruta.lon != null)
      .map((ruta) => ({
        id: ruta.id,
        nombre: ruta.nombre,
        descripcion: descripcionDe(ruta),
        lat: ruta.lat!,
        lon: ruta.lon!,
        total: totales.get(ruta.id),
      }));
    return <MapaLugares puntos={puntos} clave={clave} alAbrir={abrirLugar} />;
  }

  return (
    <>
      <CampoTexto
        etiqueta="Buscar una ruta"
        value={texto}
        onChangeText={setTexto}
        autoCorrect={false}
        returnKeyType="search"
        ayuda={
          filtradas.length > RUTAS_CON_ESTADO
            ? `Hay ${filtradas.length} rutas. Se muestran ${RUTAS_CON_ESTADO}: escribe un nombre o un pueblo para afinar.`
            : `${filtradas.length} ${filtradas.length === 1 ? 'ruta' : 'rutas'}, de mejor a peor día.`
        }
      />
      {consulta.isPending && conEstado.length > 0 ? (
        <>
          <Esqueleto alto={96} redondeo={radio.l} />
          <Esqueleto alto={96} redondeo={radio.l} />
        </>
      ) : consulta.isError ? (
        <Texto color="textoSecundario">
          No llega la previsión del monte. Las rutas están, pero sin puntuación por ahora.
        </Texto>
      ) : filtradas.length === 0 ? (
        <Texto color="textoSecundario">Ninguna ruta coincide con «{texto.trim()}».</Texto>
      ) : null}
      {puntuadas.map(({ ruta, actual, total }) => (
        <Presionable
          key={ruta.id}
          accessibilityLabel={`${ruta.nombre}. ${descripcionDe(ruta)}. Puntuación ${total} de 100. ${resumenMonte(actual)}`}
          accessibilityHint="Abre la ruta"
          onPress={() => abrirLugar(ruta.id)}
          style={[
            estilos.tarjeta,
            sombra(esOscuro),
            { backgroundColor: colores.superficie, borderColor: colores.borde },
          ]}>
          <View style={estilos.estampa}>
            <IlustracionActividad actividad="senderismo" proporcion={64 / 88} />
          </View>
          <View style={estilos.textos}>
            <Texto variante="subtitulo" numberOfLines={2}>
              {ruta.nombre}
            </Texto>
            {descripcionDe(ruta) ? (
              <Texto variante="etiqueta" color="textoSecundario" numberOfLines={1}>
                {descripcionDe(ruta)}
              </Texto>
            ) : null}
            <Texto variante="detalle" color="textoSecundario" numberOfLines={2}>
              {resumenMonte(actual)}
            </Texto>
          </View>
          <AnilloPuntuacion valor={total} tamano={54} grosor={5} />
        </Presionable>
      ))}
    </>
  );
}

/** Campos, canchas y pistas: dónde están. No tienen estado ni disponibilidad. */
function ExplorarCanchas({
  actividad,
  vista,
  region,
  clave,
}: {
  actividad: IdActividad;
  vista: Vista;
  region: string;
  clave: string;
}) {
  const { colores } = useTema();
  const [texto, setTexto] = useState('');
  const lugares = useLugares(actividad, region);
  const filtradas = filtrar(lugares.data ?? [], texto);

  if (lugares.isPending) return <Esqueleto alto={72} redondeo={radio.l} />;
  if (lugares.isError) return <SinCatalogo alReintentar={() => lugares.refetch()} />;
  if (lugares.data.length === 0) return <SinLugares actividad={actividad} />;

  if (vista === 'mapa') {
    const puntos: PuntoMapa[] = filtradas
      .filter((cancha) => cancha.lat != null && cancha.lon != null)
      .map((cancha) => ({
        id: cancha.id,
        nombre: cancha.nombre,
        descripcion: descripcionDe(cancha),
        lat: cancha.lat!,
        lon: cancha.lon!,
      }));
    return <MapaLugares puntos={puntos} clave={clave} alAbrir={abrirLugar} />;
  }

  return (
    <>
      <CampoTexto
        etiqueta="Buscar por nombre o por pueblo"
        value={texto}
        onChangeText={setTexto}
        autoCorrect={false}
        returnKeyType="search"
        ayuda={
          filtradas.length > CANCHAS_VISIBLES
            ? `Hay ${filtradas.length}. Se muestran ${CANCHAS_VISIBLES}: escribe para afinar o usa el mapa.`
            : `${filtradas.length} en tu zona.`
        }
      />
      {filtradas.length === 0 ? (
        <Texto color="textoSecundario">Nada coincide con «{texto.trim()}».</Texto>
      ) : null}
      {filtradas.slice(0, CANCHAS_VISIBLES).map((cancha) => (
        <Presionable
          key={cancha.id}
          accessibilityLabel={`${cancha.nombre}. ${descripcionDe(cancha)}`}
          accessibilityHint="Abre su ficha"
          onPress={() => abrirLugar(cancha.id)}
          style={[
            estilos.fila,
            { backgroundColor: colores.superficie, borderColor: colores.borde },
          ]}>
          <View style={estilos.miniatura}>
            <IlustracionActividad actividad={actividad} proporcion={1} />
          </View>
          <View style={estilos.textos}>
            <Texto variante="cuerpoFuerte" numberOfLines={1}>
              {cancha.nombre}
            </Texto>
            {descripcionDe(cancha) ? (
              <Texto variante="etiqueta" color="textoSecundario" numberOfLines={1}>
                {descripcionDe(cancha)}
              </Texto>
            ) : null}
          </View>
        </Presionable>
      ))}
    </>
  );
}

function SinCatalogo({ alReintentar }: { alReintentar: () => void }) {
  return (
    <EstadoVacio
      escena="sin-conexion"
      titulo="No se pudo cargar el catálogo"
      mensaje="Comprueba que tienes conexión con el servidor y vuelve a intentarlo.">
      <Boton titulo="Reintentar" onPress={alReintentar} />
    </EstadoVacio>
  );
}

function SinLugares({ actividad }: { actividad: IdActividad }) {
  const { lugares } = buscarActividad(actividad);
  return (
    <EstadoVacio
      escena="vacio"
      titulo={`Aún no hay ${lugares} en esta zona`}
      mensaje={`De momento el catálogo de ${lugares} cubre solo Canarias. Puedes crear una quedada igualmente escribiendo el sitio a mano con la actividad «Otros».`}>
      <Boton titulo="Cambiar de zona" variante="secundario" onPress={() => router.push('/zona')} />
    </EstadoVacio>
  );
}

export default function PantallaExplorar() {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const { zona } = useRegion();
  const parametros = useLocalSearchParams<{ actividad?: IdActividad }>();
  const { preferencias } = usePreferencias();
  const [actividad, setActividad] = useState<IdActividad>(
    parametros.actividad ?? (preferencias.interes === 'senderismo' ? 'senderismo' : 'playa'),
  );
  const [vista, setVista] = useState<Vista>('lista');
  useBarraEstado('clara');

  // Al llegar desde un atajo de Inicio con otra actividad, se cambia a ella. Se ajusta
  // durante el render (no en un efecto) para no pintar un fotograma con la anterior.
  const [parametroVisto, setParametroVisto] = useState(parametros.actividad);
  if (parametros.actividad !== parametroVisto) {
    setParametroVisto(parametros.actividad);
    if (parametros.actividad) setActividad(parametros.actividad);
  }

  const region = zona?.id ?? '';
  const clave = `${region}:${actividad}`;
  const elegida = buscarActividad(actividad);

  return (
    <ScrollView
      style={{ backgroundColor: colores.fondo }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: insets.bottom + ALTO_PESTANAS + espacio.l }}>
      <CabeceraCielo titulo="Explorar" subtitulo={zona ? `En ${zona.nombre}` : undefined} />
      <SelectorActividad
        actividades={ACTIVIDADES_CON_CATALOGO}
        valor={actividad}
        alCambiar={setActividad}
      />

      <View style={estilos.contenido}>
        <Segmentado etiqueta="Cómo verlo" opciones={VISTAS} valor={vista} alCambiar={setVista} />

        {actividad === 'playa' ? (
          <ExplorarPlayas vista={vista} clave={clave} />
        ) : actividad === 'senderismo' ? (
          <ExplorarRutas key={clave} vista={vista} region={region} clave={clave} />
        ) : (
          <ExplorarCanchas
            key={clave}
            actividad={actividad}
            vista={vista}
            region={region}
            clave={clave}
          />
        )}

        {actividad === 'playa' ? null : (
          <Texto variante="etiqueta" color="textoSecundario" style={estilos.creditos}>
            {elegida.lugares.charAt(0).toUpperCase() + elegida.lugares.slice(1)} de OpenStreetMap, ©
            colaboradores de OpenStreetMap.
          </Texto>
        )}
        <Boton
          titulo="Cambiar de zona"
          variante="secundario"
          onPress={() => router.push('/zona')}
        />
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { paddingHorizontal: espacio.m, paddingTop: espacio.xs, gap: espacio.s },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    padding: espacio.s,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    padding: espacio.s,
    borderRadius: radio.l,
    borderWidth: StyleSheet.hairlineWidth,
  },
  estampa: {
    width: 64,
    height: 88,
    borderRadius: radio.m,
    overflow: 'hidden',
  },
  miniatura: { width: 56, height: 56, borderRadius: radio.m, overflow: 'hidden' },
  textos: { flex: 1, gap: 2 },
  creditos: { textAlign: 'center', paddingTop: espacio.xs },
});
