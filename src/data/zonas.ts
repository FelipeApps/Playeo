import type { Playa } from '@/data/playas';

export interface Zona {
  id: string;
  nombre: string;
}

export interface GrupoZonas {
  nombre: string;
  zonas: Zona[];
}

/** Zonas del selector inicial, agrupadas. Los id coinciden con `region` en los catálogos. */
export const GRUPOS_ZONAS: GrupoZonas[] = [
  {
    nombre: 'Canarias',
    zonas: [
      { id: 'gran-canaria', nombre: 'Gran Canaria' },
      { id: 'tenerife', nombre: 'Tenerife' },
      { id: 'lanzarote', nombre: 'Lanzarote y La Graciosa' },
      { id: 'fuerteventura', nombre: 'Fuerteventura' },
      { id: 'la-palma', nombre: 'La Palma' },
      { id: 'la-gomera', nombre: 'La Gomera' },
      { id: 'el-hierro', nombre: 'El Hierro' },
    ],
  },
  {
    nombre: 'Baleares',
    zonas: [
      { id: 'mallorca', nombre: 'Mallorca' },
      { id: 'menorca', nombre: 'Menorca' },
      { id: 'ibiza', nombre: 'Ibiza' },
      { id: 'formentera', nombre: 'Formentera' },
    ],
  },
  {
    nombre: 'Península',
    zonas: [
      { id: 'galicia', nombre: 'Galicia' },
      { id: 'asturias', nombre: 'Asturias' },
      { id: 'cantabria', nombre: 'Cantabria' },
      { id: 'pais-vasco', nombre: 'País Vasco' },
      { id: 'cataluna', nombre: 'Cataluña' },
      { id: 'comunidad-valenciana', nombre: 'Comunidad Valenciana' },
      { id: 'murcia', nombre: 'Región de Murcia' },
      { id: 'andalucia', nombre: 'Andalucía' },
    ],
  },
  {
    nombre: 'Portugal',
    zonas: [
      { id: 'portugal-norte', nombre: 'Norte' },
      { id: 'portugal-centro', nombre: 'Centro' },
      { id: 'lisboa', nombre: 'Lisboa y Setúbal' },
      { id: 'alentejo', nombre: 'Alentejo' },
      { id: 'algarve', nombre: 'Algarve' },
      { id: 'madeira', nombre: 'Madeira' },
      { id: 'azores', nombre: 'Azores' },
    ],
  },
];

const ZONAS = GRUPOS_ZONAS.flatMap((grupo) => grupo.zonas);

export function buscarZona(id: string | null | undefined): Zona | undefined {
  return ZONAS.find((zona) => zona.id === id);
}

/** Encuadre del mapa que contiene todas las playas dadas, con algo de margen. */
export function encuadre(playas: Playa[]) {
  const lats = playas.map((playa) => playa.lat);
  const lons = playas.map((playa) => playa.lon);
  const [latMin, latMax] = [Math.min(...lats), Math.max(...lats)];
  const [lonMin, lonMax] = [Math.min(...lons), Math.max(...lons)];
  return {
    latitude: (latMin + latMax) / 2,
    longitude: (lonMin + lonMax) / 2,
    latitudeDelta: Math.max((latMax - latMin) * 1.35, 0.08),
    longitudeDelta: Math.max((lonMax - lonMin) * 1.35, 0.08),
  };
}
