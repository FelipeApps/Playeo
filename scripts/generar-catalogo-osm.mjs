// Genera la migración que carga en `lugares` las rutas de senderismo y las canchas de
// Canarias, a partir de OpenStreetMap (© colaboradores de OpenStreetMap, licencia ODbL).
//
//   node scripts/generar-catalogo-osm.mjs supabase/migrations/<fecha>_lugares_canarias.sql
//
// De cada ruta se guarda un punto (el centro de su trazado), no el recorrido completo.
import { writeFileSync } from 'node:fs';

const AGENTE = { 'User-Agent': 'Planeo/0.1 (prototipo Expo; catalogo de rutas y canchas)' };
// Los servidores públicos de Overpass se saturan a menudo: se prueba con varios.
const SERVIDORES = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Islas: id de zona de la app y rectángulo [sur, oeste, norte, este].
const ISLAS = [
  ['el-hierro', 27.6, -18.2, 27.9, -17.85],
  ['la-palma', 28.4, -18.05, 28.9, -17.7],
  ['la-gomera', 27.98, -17.4, 28.25, -17.05],
  ['tenerife', 27.95, -16.95, 28.65, -16.05],
  ['gran-canaria', 27.7, -15.9, 28.2, -15.3],
  ['fuerteventura', 28.0, -14.55, 28.78, -13.8],
  ['lanzarote', 28.8, -13.95, 29.45, -13.3],
];

const DEPORTES = {
  soccer: ['futbol', 'Campo de fútbol'],
  futsal: ['futbol', 'Pista de fútbol sala'],
  basketball: ['baloncesto', 'Cancha de baloncesto'],
  padel: ['padel', 'Pista de pádel'],
};

const espera = (ms) => new Promise((listo) => setTimeout(listo, ms));

async function overpass(consulta) {
  for (let ronda = 1; ronda <= 6; ronda++) {
    for (const servidor of SERVIDORES) {
      try {
        const respuesta = await fetch(servidor, {
          method: 'POST',
          headers: { ...AGENTE, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(consulta)}`,
          signal: AbortSignal.timeout(120000),
        });
        if (respuesta.ok) return (await respuesta.json()).elements;
      } catch {
        // Se prueba con el siguiente servidor.
      }
    }
    await espera(10000 * ronda);
  }
  throw new Error('Ningún servidor de Overpass respondió');
}

function metros(a, b) {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

const punto = (elemento) => ({
  lat: elemento.lat ?? elemento.center?.lat,
  lon: elemento.lon ?? elemento.center?.lon,
});

const lugares = [];

for (const [region, sur, oeste, norte, este] of ISLAS) {
  const caja = `(${sur},${oeste},${norte},${este})`;
  const elementos = await overpass(`[out:json][timeout:110];
    (
      relation["route"="hiking"]["name"]${caja};
      nwr["leisure"="pitch"]["sport"~"^(soccer|futsal|basketball|padel)$"]${caja};
      node["place"~"^(city|town|village|suburb|neighbourhood|hamlet)$"]["name"]${caja};
    );
    out center tags;`);

  const poblaciones = elementos
    .filter((e) => e.tags?.place)
    .map((e) => ({ nombre: e.tags.name, ...punto(e) }));
  const cercaDe = (sitio) => {
    let mejor = null;
    for (const poblacion of poblaciones) {
      const distancia = metros(sitio, poblacion);
      if (distancia < 4000 && (!mejor || distancia < mejor.distancia)) {
        mejor = { nombre: poblacion.nombre, distancia };
      }
    }
    return mejor?.nombre ?? null;
  };

  // Rutas: una por nombre (OSM repite algunas como ida y vuelta o por tramos).
  const rutas = new Map();
  for (const e of elementos.filter((x) => x.tags?.route === 'hiking')) {
    const sitio = punto(e);
    if (sitio.lat == null) continue;
    const nombre = e.tags.name.trim();
    if (rutas.has(nombre.toLowerCase())) continue;
    const km = Number.parseFloat(String(e.tags.distance ?? '').replace(',', '.'));
    rutas.set(nombre.toLowerCase(), {
      id: `ruta-osm-${e.id}`,
      nombre,
      region,
      tipo: 'ruta',
      actividad: 'senderismo',
      ...sitio,
      datos: {
        ...(e.tags.ref ? { referencia: e.tags.ref } : {}),
        ...(Number.isFinite(km) && km > 0 ? { km: Math.round(km * 10) / 10 } : {}),
        ...(cercaDe(sitio) ? { cerca_de: cercaDe(sitio) } : {}),
        osm: `relation/${e.id}`,
      },
    });
  }

  // Canchas: muchas no tienen nombre; se les da uno legible con la población cercana.
  const canchas = [];
  for (const e of elementos.filter((x) => x.tags?.leisure === 'pitch')) {
    const sitio = punto(e);
    const deporte = DEPORTES[e.tags.sport];
    if (sitio.lat == null || !deporte) continue;
    if (e.tags.access === 'private' || e.tags.access === 'no') continue;
    const [actividad, generico] = deporte;
    // En un mismo recinto suele haber varias pistas pegadas: basta con una.
    if (canchas.some((c) => c.actividad === actividad && metros(c, sitio) < 120)) continue;
    const poblacion = cercaDe(sitio);
    canchas.push({
      id: `cancha-osm-${e.type[0]}${e.id}`,
      nombre: e.tags.name?.trim() || (poblacion ? `${generico} de ${poblacion}` : generico),
      region,
      tipo: 'cancha',
      actividad,
      ...sitio,
      datos: {
        ...(poblacion ? { cerca_de: poblacion } : {}),
        ...(e.tags.surface ? { superficie: e.tags.surface } : {}),
        ...(e.tags.lit === 'yes' ? { iluminada: true } : {}),
        osm: `${e.type}/${e.id}`,
      },
    });
  }

  console.log(`${region}: ${rutas.size} rutas, ${canchas.length} canchas`);
  lugares.push(...rutas.values(), ...canchas);
  await espera(4000);
}

// Una ruta que aparece en varias islas es un gran recorrido interinsular (como el E7):
// su punto central caería en el mar, así que no sirve como lugar para quedar.
const apariciones = new Map();
for (const lugar of lugares) apariciones.set(lugar.id, (apariciones.get(lugar.id) ?? 0) + 1);
const repetidos = lugares.filter((lugar) => apariciones.get(lugar.id) > 1);
for (const repetido of repetidos) lugares.splice(lugares.indexOf(repetido), 1);

const sql = (texto) => `'${String(texto).replace(/'/g, "''")}'`;
const filas = lugares
  .map(
    (l) =>
      `  (${sql(l.id)}, ${sql(l.nombre)}, ${sql(l.region)}, ${sql(l.tipo)}, ${sql(l.actividad)}, ` +
      `${l.lat.toFixed(5)}, ${l.lon.toFixed(5)}, ${sql(JSON.stringify(l.datos))}::jsonb)`,
  )
  .join(',\n');

const resumen = Object.entries(
  lugares.reduce((cuenta, l) => ({ ...cuenta, [l.actividad]: (cuenta[l.actividad] ?? 0) + 1 }), {}),
)
  .map(([actividad, total]) => `${total} de ${actividad}`)
  .join(', ');

const destino = process.argv[2];
if (!destino) throw new Error('Falta la ruta de la migración de destino');
writeFileSync(
  destino,
  `-- Rutas de senderismo y canchas de Canarias, generadas por scripts/generar-catalogo-osm.mjs.
-- Datos de OpenStreetMap, © colaboradores de OpenStreetMap, bajo licencia ODbL.
-- ${lugares.length} lugares: ${resumen}. No editar a mano: regenerar.

insert into public.lugares (id, nombre, region, tipo, actividad_id, lat, lon, datos) values
${filas}
on conflict (id) do update set
  nombre = excluded.nombre, region = excluded.region, tipo = excluded.tipo,
  actividad_id = excluded.actividad_id, lat = excluded.lat, lon = excluded.lon, datos = excluded.datos;
`,
);
console.log(`${lugares.length} lugares escritos en ${destino} (${resumen})`);
