// Genera src/data/playas-wikidata.json: las playas más conocidas de cada zona costera
// de España y Portugal, con coordenadas y foto tomadas de Wikidata y Wikimedia Commons.
//
//   node scripts/generar-catalogo.mjs
//
// Gran Canaria no se genera aquí: su catálogo está escrito a mano en playas.json, con
// características (socorrista, surf...) que Wikidata no tiene.
import { writeFileSync } from 'node:fs';

const AGENTE = { 'User-Agent': 'Planeo/0.1 (prototipo Expo; catalogo de playas)' };
const PLAYAS_POR_ZONA = 15;
/** Candidatas que se comprueban contra la API marina para quedarse con PLAYAS_POR_ZONA. */
const CANDIDATAS_POR_ZONA = 30;

// Cada zona es un rectángulo [latMin, latMax, lonMin, lonMax]. Se evalúan en orden y
// gana la primera que contiene el punto, así que las islas van antes que la península.
const ZONAS = [
  ['el-hierro', 'ES', 27.6, 27.9, -18.2, -17.85],
  ['la-palma', 'ES', 28.4, 28.9, -18.05, -17.7],
  ['la-gomera', 'ES', 27.98, 28.25, -17.4, -17.05],
  ['tenerife', 'ES', 27.95, 28.65, -16.95, -16.05],
  ['gran-canaria', 'ES', 27.7, 28.2, -15.9, -15.3],
  ['fuerteventura', 'ES', 28.0, 28.78, -14.55, -13.8],
  ['lanzarote', 'ES', 28.8, 29.45, -13.95, -13.3],
  ['mallorca', 'ES', 39.1, 39.98, 2.3, 3.5],
  ['menorca', 'ES', 39.78, 40.1, 3.75, 4.35],
  ['formentera', 'ES', 38.62, 38.82, 1.35, 1.62],
  ['ibiza', 'ES', 38.8, 39.13, 1.15, 1.67],
  ['galicia', 'ES', 41.8, 43.85, -9.4, -7.03],
  ['asturias', 'ES', 43.1, 43.75, -7.03, -4.51],
  ['cantabria', 'ES', 43.1, 43.6, -4.51, -3.15],
  ['pais-vasco', 'ES', 43.1, 43.5, -3.15, -1.75],
  ['cataluna', 'ES', 40.52, 42.5, 0.1, 3.4],
  ['comunidad-valenciana', 'ES', 37.845, 40.52, -0.85, 0.75],
  ['murcia', 'ES', 37.37, 37.845, -1.63, -0.6],
  ['andalucia', 'ES', 35.95, 37.4, -7.53, -1.63],
  ['madeira', 'PT', 32.3, 33.2, -17.4, -16.2],
  ['azores', 'PT', 36.8, 39.8, -31.5, -24.9],
  ['portugal-norte', 'PT', 40.93, 41.95, -9.0, -8.4],
  ['portugal-centro', 'PT', 39.0, 40.93, -9.6, -8.5],
  ['lisboa', 'PT', 38.4, 39.0, -9.6, -8.7],
  ['alentejo', 'PT', 37.44, 38.4, -9.0, -8.5],
  ['algarve', 'PT', 36.9, 37.44, -9.05, -7.35],
];

const PAISES = { ES: 'Q29', PT: 'Q45' };

async function json(url, opciones = {}) {
  for (let intento = 1; ; intento++) {
    const respuesta = await fetch(url, {
      ...opciones,
      headers: { ...AGENTE, ...opciones.headers },
    });
    if (respuesta.ok) return respuesta.json();
    if (intento === 5) throw new Error(`${respuesta.status} en ${url.slice(0, 90)}`);
    await new Promise((listo) => setTimeout(listo, 20000 * intento));
  }
}

/** Todas las playas de un país con coordenadas, y su foto y municipio si los tienen. */
async function playasDe(pais) {
  const consulta = `
    SELECT ?playa ?playaLabel ?coord ?foto ?enlaces ?municipioLabel WHERE {
      ?playa wdt:P31/wdt:P279* wd:Q40080; wdt:P17 wd:${PAISES[pais]}; wdt:P625 ?coord.
      OPTIONAL { ?playa wdt:P18 ?foto }
      OPTIONAL { ?playa wikibase:sitelinks ?enlaces }
      OPTIONAL { ?playa wdt:P131 ?municipio }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,pt,gl,ca,eu,en". }
    }`;
  const datos = await json(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(consulta)}`,
  );
  const porId = new Map();
  for (const fila of datos.results.bindings) {
    const qid = fila.playa.value.split('/').pop();
    const [, lon, lat] = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(fila.coord.value) ?? [];
    const nombre = fila.playaLabel?.value ?? qid;
    // Sin nombre legible o de río: fuera.
    if (!lat || nombre === qid || /fluvial/i.test(nombre) || porId.has(qid)) continue;
    porId.set(qid, {
      qid,
      pais,
      nombre,
      lat: Number(lat),
      lon: Number(lon),
      enlaces: Number(fila.enlaces?.value ?? 0),
      archivo: fila.foto
        ? decodeURIComponent(fila.foto.value.split('/Special:FilePath/')[1])
        : null,
      municipio: fila.municipioLabel?.value ?? '',
    });
  }
  return [...porId.values()];
}

function zonaDe(playa) {
  const zona = ZONAS.find(
    ([, pais, latMin, latMax, lonMin, lonMax]) =>
      pais === playa.pais &&
      playa.lat >= latMin &&
      playa.lat <= latMax &&
      playa.lon >= lonMin &&
      playa.lon <= lonMax,
  );
  return zona?.[0];
}

function metros(a, b) {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

/** Se queda con las que tienen mar cerca según Open-Meteo: descarta playas de interior. */
async function conMar(candidatas) {
  const url =
    'https://marine-api.open-meteo.com/v1/marine?current=wave_height' +
    `&latitude=${candidatas.map((p) => p.lat).join(',')}` +
    `&longitude=${candidatas.map((p) => p.lon).join(',')}`;
  const cuerpo = await json(url);
  const lista = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
  return candidatas.filter((_, i) => typeof lista[i]?.current?.wave_height === 'number');
}

/** Autor, licencia y miniatura de cada foto, para poder citarla. */
async function creditos(archivos) {
  const resultado = new Map();
  for (let i = 0; i < archivos.length; i += 40) {
    const lote = archivos.slice(i, i + 40);
    const parametros = new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime',
      iiurlwidth: '960',
      titles: lote.map((archivo) => `File:${archivo}`).join('|'),
    });
    const datos = await json(`https://commons.wikimedia.org/w/api.php?${parametros}`);
    const normalizados = new Map((datos.query.normalized ?? []).map((par) => [par.to, par.from]));
    for (const pagina of Object.values(datos.query.pages ?? {})) {
      const info = pagina.imageinfo?.[0];
      if (!info || !/^image\/(jpeg|png)$/.test(info.mime)) continue;
      const meta = info.extmetadata ?? {};
      const limpio = (html) =>
        (html ?? '')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();
      const titulo = (normalizados.get(pagina.title) ?? pagina.title).replace(/^File:/, '');
      resultado.set(titulo.replace(/_/g, ' '), {
        url: info.thumburl,
        autor: limpio(meta.Artist?.value).slice(0, 60) || 'Autor desconocido',
        licencia: meta.LicenseShortName?.value ?? '',
        pagina: info.descriptionurl,
      });
    }
  }
  return resultado;
}

function identificador(nombre, qid) {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base}-${qid.toLowerCase()}`;
}

const todas = [...(await playasDe('ES')), ...(await playasDe('PT'))];
console.log(`Wikidata: ${todas.length} playas con coordenadas`);

const porZona = new Map();
for (const playa of todas) {
  const zona = zonaDe(playa);
  if (!zona || zona === 'gran-canaria') continue;
  if (!porZona.has(zona)) porZona.set(zona, []);
  porZona.get(zona).push(playa);
}

const elegidas = [];
for (const [zona] of ZONAS) {
  const lista = porZona.get(zona);
  if (!lista) continue;
  // Las más conocidas primero: más artículos en Wikipedia y, a igualdad, las que tienen foto.
  lista.sort((a, b) => b.enlaces - a.enlaces || Number(!!b.archivo) - Number(!!a.archivo));

  const candidatas = [];
  for (const playa of lista) {
    if (candidatas.some((otra) => metros(otra, playa) < 250)) continue; // duplicados
    candidatas.push(playa);
    if (candidatas.length === CANDIDATAS_POR_ZONA) break;
  }
  const validas = (await conMar(candidatas)).slice(0, PLAYAS_POR_ZONA);
  // Open-Meteo cuenta cada coordenada como una petición: se espacia para no pasar su límite.
  await new Promise((listo) => setTimeout(listo, 6000));
  console.log(`${zona}: ${lista.length} en Wikidata, ${validas.length} elegidas`);
  for (const playa of validas) elegidas.push({ ...playa, region: zona });
}

const fotos = await creditos(elegidas.filter((p) => p.archivo).map((p) => p.archivo));

const catalogo = elegidas.map((playa) => ({
  id: identificador(playa.nombre, playa.qid),
  nombre: playa.nombre,
  municipio: playa.municipio,
  region: playa.region,
  zona: null,
  lat: Number(playa.lat.toFixed(5)),
  lon: Number(playa.lon.toFixed(5)),
  coordenadasVerificadas: true,
  tipo: null,
  caracteristicas: null,
  descripcion: null,
  foto: playa.archivo ? (fotos.get(playa.archivo.replace(/_/g, ' ')) ?? null) : null,
  wikidata: playa.qid,
}));

writeFileSync(
  new URL('../src/data/playas-wikidata.json', import.meta.url),
  `${JSON.stringify(catalogo, null, 1)}\n`,
);
console.log(
  `Escritas ${catalogo.length} playas, ${catalogo.filter((p) => p.foto).length} con foto.`,
);
