/** Lo mínimo que hace falta de un sitio para pedir su tiempo. */
export interface Punto {
  id: string;
  lat: number;
  lon: number;
}

/**
 * Cliente de Open-Meteo (gratuito, sin clave). Tres APIs, una petición a cada una con
 * las coordenadas de todas las playas a la vez:
 *  - Weather: viento, temperatura, nubosidad y UV.
 *  - Marine: oleaje y temperatura del mar.
 *  - Air Quality: polvo en suspensión y AOD, para detectar calima.
 * Documentación: https://open-meteo.com/en/docs
 */

// 'auto' da las horas en la hora local de cada playa: Canarias, península, Azores...
const ZONA_HORARIA = 'auto';
const TIEMPO =
  'temperature_2m,apparent_temperature,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,cloud_cover_low,visibility,uv_index';
const MAR = 'wave_height,wave_period,sea_surface_temperature';
const AIRE = 'dust,aerosol_optical_depth';

/** Estado de una playa en un momento concreto. El mar y el aire pueden venir sin dato. */
export interface Medicion {
  /** Hora local de la playa, ISO sin zona: "2026-10-09T14:00". */
  hora: string;
  /** °C */
  temperatura: number;
  /** Sensación térmica, °C. */
  sensacion: number;
  /** Lluvia en la hora, mm. */
  lluvia: number;
  /** Probabilidad de lluvia, %. */
  probLluvia: number;
  /** % de cielo cubierto por nubes bajas: en el monte, las que tapan el camino. */
  nubesBajas: number;
  /** Visibilidad en metros, o `null` sin dato. */
  visibilidad: number | null;
  /** km/h */
  viento: number;
  /** km/h */
  rachas: number;
  /** Grados desde los que sopla (0 = norte). */
  direccionViento: number;
  /** % de cielo cubierto. */
  nubosidad: number;
  uv: number;
  /** Altura significativa de ola en mar abierto, en metros. */
  olaAltura: number | null;
  /** Segundos entre olas. */
  olaPeriodo: number | null;
  /** °C */
  tempAgua: number | null;
  /** Polvo en suspensión, µg/m³. */
  polvo: number | null;
  /** Profundidad óptica de aerosoles (adimensional). */
  aod: number | null;
}

export interface CondicionesPlaya {
  actual: Medicion;
  esDeDia: boolean;
  /** Las 24 horas de hoy. */
  horas: Medicion[];
}

export interface Condiciones {
  porPlaya: Record<string, CondicionesPlaya>;
  /** Marca de tiempo (ms) de la descarga. */
  obtenido: number;
}

type Serie = Record<string, (number | string | null)[] | undefined>;
type Instante = Record<string, number | string | null | undefined>;
interface Respuesta {
  current?: Instante;
  hourly?: Serie;
}

async function pedir(
  base: string,
  playas: Punto[],
  variables: string,
  signal?: AbortSignal,
  soloActual = '',
) {
  const parametros = [
    `latitude=${playas.map((playa) => playa.lat).join(',')}`,
    `longitude=${playas.map((playa) => playa.lon).join(',')}`,
    `current=${variables}${soloActual}`,
    `hourly=${variables}`,
    `timezone=${encodeURIComponent(ZONA_HORARIA)}`,
    'forecast_days=1',
  ].join('&');

  const respuesta = await fetch(`${base}?${parametros}`, { signal });
  if (!respuesta.ok) throw new Error(`Open-Meteo respondió ${respuesta.status}`);
  const cuerpo: Respuesta | Respuesta[] = await respuesta.json();
  // Con una sola ubicación la API devuelve un objeto en vez de una lista.
  return Array.isArray(cuerpo) ? cuerpo : [cuerpo];
}

function numero(valor: number | string | null | undefined): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function medicion(tiempo: Instante, mar: Instante, aire: Instante): Medicion {
  return {
    hora: String(tiempo.time ?? ''),
    temperatura: numero(tiempo.temperature_2m) ?? 0,
    sensacion: numero(tiempo.apparent_temperature) ?? numero(tiempo.temperature_2m) ?? 0,
    lluvia: numero(tiempo.precipitation) ?? 0,
    probLluvia: numero(tiempo.precipitation_probability) ?? 0,
    nubesBajas: numero(tiempo.cloud_cover_low) ?? 0,
    visibilidad: numero(tiempo.visibility),
    viento: numero(tiempo.wind_speed_10m) ?? 0,
    rachas: numero(tiempo.wind_gusts_10m) ?? 0,
    direccionViento: numero(tiempo.wind_direction_10m) ?? 0,
    nubosidad: numero(tiempo.cloud_cover) ?? 0,
    uv: numero(tiempo.uv_index) ?? 0,
    olaAltura: numero(mar.wave_height),
    olaPeriodo: numero(mar.wave_period),
    tempAgua: numero(mar.sea_surface_temperature),
    polvo: numero(aire.dust),
    aod: numero(aire.aerosol_optical_depth),
  };
}

/** Saca de una serie horaria el instante de la posición `indice`. */
function enHora(serie: Serie | undefined, indice: number): Instante {
  const instante: Instante = {};
  for (const clave in serie) instante[clave] = serie[clave]?.[indice];
  return instante;
}

export async function obtenerCondiciones(
  playas: Punto[],
  signal?: AbortSignal,
  /** Falso para sitios de interior (rutas de monte): no se pide el estado del mar. */
  conMar = true,
): Promise<Condiciones> {
  const [tiempo, mar, aire] = await Promise.all([
    pedir('https://api.open-meteo.com/v1/forecast', playas, TIEMPO, signal, ',is_day'),
    conMar
      ? pedir('https://marine-api.open-meteo.com/v1/marine', playas, MAR, signal)
      : Promise.resolve([] as Respuesta[]),
    pedir('https://air-quality-api.open-meteo.com/v1/air-quality', playas, AIRE, signal),
  ]);

  const porPlaya: Record<string, CondicionesPlaya> = {};
  playas.forEach((playa, i) => {
    const actualTiempo = tiempo[i]?.current;
    if (!actualTiempo) return;

    const horas = (tiempo[i].hourly?.time ?? []).map((_, h) =>
      medicion(enHora(tiempo[i].hourly, h), enHora(mar[i]?.hourly, h), enHora(aire[i]?.hourly, h)),
    );
    porPlaya[playa.id] = {
      actual: medicion(actualTiempo, mar[i]?.current ?? {}, aire[i]?.current ?? {}),
      esDeDia: actualTiempo.is_day !== 0,
      horas,
    };
  });

  if (Object.keys(porPlaya).length === 0) throw new Error('Open-Meteo no devolvió datos');
  return { porPlaya, obtenido: Date.now() };
}

/**
 * Previsión hora a hora de una playa para el día de un evento y el siguiente.
 * Las horas vienen en UTC ("2026-10-12T16:00"), para casarlas con la hora del evento
 * sin depender de la zona horaria de la playa ni de la del móvil.
 *
 * Open-Meteo cubre unos 16 días de tiempo, 8 de mar y 5 de calidad del aire. Si el
 * evento queda fuera del alcance del tiempo, lanza un error; si solo faltan el mar o
 * el aire, esas medidas llegan sin dato.
 */
export async function obtenerPrevisionDia(
  playa: Pick<Punto, 'lat' | 'lon'>,
  momento: Date,
  signal?: AbortSignal,
  conMar = true,
): Promise<Medicion[]> {
  const dia = (fecha: Date) => fecha.toISOString().slice(0, 10);
  const siguiente = new Date(momento.getTime() + 24 * 60 * 60 * 1000);
  const comunes = `latitude=${playa.lat}&longitude=${playa.lon}&timezone=GMT&start_date=${dia(momento)}&end_date=${dia(siguiente)}`;

  const pedirSerie = async (base: string, variables: string): Promise<Serie> => {
    const respuesta = await fetch(`${base}?${comunes}&hourly=${variables}`, { signal });
    if (!respuesta.ok) throw new Error(`Open-Meteo respondió ${respuesta.status}`);
    const cuerpo: Respuesta = await respuesta.json();
    return cuerpo.hourly ?? {};
  };

  const [tiempo, mar, aire] = await Promise.allSettled([
    pedirSerie('https://api.open-meteo.com/v1/forecast', TIEMPO),
    conMar
      ? pedirSerie('https://marine-api.open-meteo.com/v1/marine', MAR)
      : Promise.resolve({} as Serie),
    pedirSerie('https://air-quality-api.open-meteo.com/v1/air-quality', AIRE),
  ]);
  if (tiempo.status === 'rejected') throw tiempo.reason;

  const serieMar = mar.status === 'fulfilled' ? mar.value : {};
  const serieAire = aire.status === 'fulfilled' ? aire.value : {};
  return (tiempo.value.time ?? []).map((_, h) =>
    medicion(enHora(tiempo.value, h), enHora(serieMar, h), enHora(serieAire, h)),
  );
}
