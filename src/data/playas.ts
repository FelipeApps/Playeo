import generadas from './playas-wikidata.json';
import datos from './playas.json';

// DOS CATÁLOGOS
// - playas.json: Gran Canaria, escrito a mano, con tipo de costa y características.
// - playas-wikidata.json: el resto de zonas, generado por scripts/generar-catalogo.mjs
//   desde Wikidata. Trae coordenadas y foto, pero no tipo ni características (van a null).
//
// ⚠️ COORDENADAS POR VERIFICAR (solo playas.json)
// Las coordenadas (lat/lon) de playas.json son aproximadas y están escritas a mano.
// JSON no admite comentarios, así que cada playa lleva `coordenadasVerificadas: false`.
// Comprueba cada una (por ejemplo en la pestaña Mapa o en Google Maps) y cambia el
// campo a `true` cuando esté revisada. Conviene que el punto caiga sobre la orilla:
// Open-Meteo Marine usa la celda de mar más cercana.
//
// ⚠️ FOTOS POR VERIFICAR
// Las fotos se eligieron en Wikimedia Commons por su título y su miniatura. Comprueba
// que cada una corresponde a su playa; el autor y la licencia se muestran en el detalle.

export type Zona = 'norte' | 'sur' | 'este' | 'oeste';
export type TipoPlaya = 'arena' | 'callaos' | 'piscina-natural';

export interface Caracteristicas {
  /** Apta para ir con niños: entrada suave, servicios cerca. */
  ninos: boolean;
  surf: boolean;
  snorkel: boolean;
  socorrista: boolean;
  /** Protegida del mar abierto por un dique, una barra o por ser piscina natural. */
  resguardada: boolean;
}

/** Foto de Wikimedia Commons. La licencia obliga a citar al autor. */
export interface Foto {
  url: string;
  autor: string;
  licencia: string;
  /** Página de la foto en Commons, con la licencia completa. */
  pagina: string;
}

export interface Playa {
  id: string;
  nombre: string;
  /** Puede venir vacío en las playas de Wikidata. */
  municipio: string;
  /** Zona del selector a la que pertenece (ver zonas.ts). */
  region: string;
  /** Parte de la isla. Solo en el catálogo a mano. */
  zona: Zona | null;
  lat: number;
  lon: number;
  coordenadasVerificadas: boolean;
  /** `null` en las playas de Wikidata: no se conoce. */
  tipo: TipoPlaya | null;
  /** `null` en las playas de Wikidata: la puntuación usa solo el tiempo y el mar. */
  caracteristicas: Caracteristicas | null;
  descripcion: string | null;
  /** `null` si no hay foto libre: se muestra la ilustración de su tipo de costa. */
  foto: Foto | null;
}

export const playas = [...(datos as Playa[]), ...(generadas as Playa[])];

const porId = new Map(playas.map((playa) => [playa.id, playa]));
const porRegion = new Map<string, Playa[]>();
for (const playa of playas) {
  const lista = porRegion.get(playa.region);
  if (lista) lista.push(playa);
  else porRegion.set(playa.region, [playa]);
}

export function buscarPlaya(id: string): Playa | undefined {
  return porId.get(id);
}

/** Playas de una zona del selector. */
export function playasDe(region: string): Playa[] {
  return porRegion.get(region) ?? [];
}

/** "Mogán, sur", "Vigo" o "" según lo que se sepa de la playa. */
export function lugarDe(playa: Playa): string {
  return [playa.municipio, playa.zona].filter(Boolean).join(', ');
}
