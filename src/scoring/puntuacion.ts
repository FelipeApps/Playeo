/**
 * Puntuación diaria de una playa, de 0 a 100. Función pura: no lee la hora, la red ni
 * el almacenamiento, así que el mismo dato de entrada da siempre el mismo resultado.
 *
 * CÓMO SE CALCULA
 * 1. Cada factor (viento, oleaje, UV, nubosidad y calima) se convierte en una nota de
 *    0 a 1, donde 1 es lo ideal para el plan elegido.
 * 2. Las notas se combinan con una media ponderada. Los pesos dependen del plan:
 *    para surf manda el oleaje; con niños pesan más el oleaje y el UV.
 * 3. El oleaje se interpreta al revés según el plan: para bañarse, hacer snorkel o ir
 *    con niños, cuanto menos mar mejor; para surf, el mar en calma es lo peor.
 * 4. Ajustes finales: si la playa no es adecuada para el plan (no es de surf, no es apta
 *    para niños...) la nota se reduce, y con calima fuerte se limita la nota máxima de
 *    quien se ha declarado sensible.
 *
 * Los umbrales son criterios razonables para un prototipo, no un estándar oficial.
 */

export type Plan = 'bano' | 'surf' | 'ninos' | 'snorkel';
export type ToleranciaViento = 'baja' | 'media' | 'alta';

export interface Preferencias {
  plan: Plan;
  toleranciaViento: ToleranciaViento;
  sensibleCalima: boolean;
}

export const PREFERENCIAS_POR_DEFECTO: Preferencias = {
  plan: 'bano',
  toleranciaViento: 'media',
  sensibleCalima: false,
};

/** Lo que la puntuación necesita saber del tiempo. `null` = sin dato. */
export interface DatosTiempo {
  viento: number;
  rachas: number;
  nubosidad: number;
  uv: number;
  olaAltura: number | null;
  olaPeriodo: number | null;
  polvo: number | null;
  aod: number | null;
}

/** Lo que la puntuación necesita saber de la playa. */
export interface DatosPlaya {
  ninos: boolean;
  surf: boolean;
  snorkel: boolean;
  resguardada: boolean;
}

export type Factor = 'viento' | 'oleaje' | 'uv' | 'nubosidad' | 'calima';

export interface Puntuacion {
  /** Entero de 0 a 100. */
  total: number;
  /** Nota de cada factor, de 0 (malo) a 1 (ideal), para explicar el resultado. */
  factores: Record<Factor, number>;
}

export type NivelCalima = 'ninguna' | 'ligera' | 'fuerte';

/** Pesos de cada factor por plan. Cada fila suma 1. */
export const PESOS: Record<Plan, Record<Factor, number>> = {
  bano: { viento: 0.3, oleaje: 0.3, uv: 0.1, nubosidad: 0.15, calima: 0.15 },
  surf: { viento: 0.2, oleaje: 0.6, uv: 0.05, nubosidad: 0.05, calima: 0.1 },
  ninos: { viento: 0.25, oleaje: 0.35, uv: 0.2, nubosidad: 0.1, calima: 0.1 },
  snorkel: { viento: 0.2, oleaje: 0.45, uv: 0.05, nubosidad: 0.15, calima: 0.15 },
};

/**
 * Nota que se obtiene justo en el límite de lo cómodo (viento cómodo, ola ideal).
 * Por debajo del límite la nota sigue subiendo hasta 1, para que dos playas buenas
 * no empaten a 100 y el ranking distinga la brisa de la calma total.
 */
const NOTA_EN_EL_LIMITE = 0.8;

/** Viento (km/h) hasta el que cada tolerancia está cómoda. */
const VIENTO_COMODO: Record<ToleranciaViento, number> = { baja: 12, media: 20, alta: 28 };
/** Margen (km/h) sobre el viento cómodo a partir del cual la nota es 0. */
const MARGEN_VIENTO = 25;

/** Una playa resguardada (dique, barra, piscina natural) recibe solo parte del mar abierto. */
const ATENUACION_RESGUARDO = 0.4;

/** Altura de ola (m): `ideal` es el tope de lo cómodo; desde `limite` la nota es 0. */
const OLEAJE_TRANQUILO: Record<Exclude<Plan, 'surf'>, { ideal: number; limite: number }> = {
  bano: { ideal: 0.5, limite: 2 },
  ninos: { ideal: 0.3, limite: 1.2 },
  snorkel: { ideal: 0.4, limite: 1.5 },
};

/** Factor por el que se multiplica la nota si la playa no encaja con el plan. */
const PENALIZACION_NO_APTA: Record<Plan, number> = { bano: 1, surf: 0.6, ninos: 0.7, snorkel: 0.7 };

/** Nota máxima con calima fuerte para quien es sensible. */
const TOPE_CALIMA_SENSIBLE = 45;

function limitar(valor: number, minimo = 0, maximo = 1) {
  return Math.min(maximo, Math.max(minimo, valor));
}

/**
 * Nota de algo que cuanto menos, mejor: 1 hasta `pleno`, baja a NOTA_EN_EL_LIMITE en
 * `comodo` y de ahí a 0 en `limite`.
 */
function notaDecreciente(valor: number, pleno: number, comodo: number, limite: number) {
  if (valor <= comodo) return 1 - (1 - NOTA_EN_EL_LIMITE) * rampa(valor, pleno, comodo);
  return NOTA_EN_EL_LIMITE * (1 - rampa(valor, comodo, limite));
}

/** 0 hasta `desde`, 1 a partir de `hasta`, lineal entre medias. */
function rampa(valor: number, desde: number, hasta: number) {
  return limitar((valor - desde) / (hasta - desde));
}

/** Altura de ola que llega de verdad a la orilla de esta playa. */
export function olaEfectiva(olaAltura: number | null, resguardada: boolean): number | null {
  if (olaAltura == null) return null;
  return resguardada ? olaAltura * ATENUACION_RESGUARDO : olaAltura;
}

/**
 * Intensidad de la calima de 0 a 1. Se queda con la señal más alta de las dos:
 * polvo en superficie (40 µg/m³ empieza a notarse, 250 es un episodio serio) y
 * AOD, la turbidez de toda la columna de aire (0,3 a 1).
 */
export function intensidadCalima(polvo: number | null, aod: number | null): number {
  return Math.max(rampa(polvo ?? 0, 40, 250), rampa(aod ?? 0, 0.3, 1));
}

export function nivelCalima(intensidad: number): NivelCalima {
  if (intensidad < 0.15) return 'ninguna';
  return intensidad < 0.5 ? 'ligera' : 'fuerte';
}

/** Viento: las rachas cuentan un 30 %, porque son las que levantan arena y sombrillas. */
function notaViento(tiempo: DatosTiempo, tolerancia: ToleranciaViento) {
  const efectivo = tiempo.viento * 0.7 + tiempo.rachas * 0.3;
  const comodo = VIENTO_COMODO[tolerancia];
  return notaDecreciente(efectivo, comodo * 0.25, comodo, comodo + MARGEN_VIENTO);
}

function notaOleaje(tiempo: DatosTiempo, resguardada: boolean, plan: Plan) {
  const altura = olaEfectiva(tiempo.olaAltura, resguardada);
  if (altura == null) return 0.5; // sin dato del mar: ni premia ni castiga

  if (plan !== 'surf') {
    const { ideal, limite } = OLEAJE_TRANQUILO[plan];
    return notaDecreciente(altura, ideal * 0.4, ideal, limite);
  }

  // Surf: sin ola no hay sesión (0 por debajo de 0,3 m), lo bueno está entre 1 y 2,2 m
  // y a partir de ahí el mar se vuelve exigente. El periodo largo (mar de fondo
  // ordenado) vale más que el corto (mar de viento).
  const porAltura = altura <= 2.2 ? rampa(altura, 0.3, 1) : 1 - 0.7 * rampa(altura, 2.2, 3.5);
  const porPeriodo = 0.7 + 0.3 * rampa(tiempo.olaPeriodo ?? 8, 6, 10);
  return porAltura * porPeriodo;
}

/** UV: cómodo hasta 5; con niños se empieza a penalizar antes y con más dureza. */
function notaUv(uv: number, plan: Plan) {
  return plan === 'ninos' ? 1 - rampa(uv, 3, 11) : 1 - 0.7 * rampa(uv, 5, 11);
}

/** Nubosidad: el sol suma, pero un día cubierto sigue siendo día de playa. */
function notaNubosidad(nubosidad: number) {
  return 1 - 0.7 * rampa(nubosidad, 0, 100);
}

/**
 * `playa` es `null` cuando no se conocen sus características (catálogo de Wikidata):
 * se trata como playa abierta y no se penaliza por no encajar con el plan, porque no
 * saber si es de surf no es lo mismo que saber que no lo es.
 */
export function puntuar(
  tiempo: DatosTiempo,
  playa: DatosPlaya | null,
  preferencias: Preferencias,
): Puntuacion {
  const { plan, toleranciaViento, sensibleCalima } = preferencias;
  const calima = intensidadCalima(tiempo.polvo, tiempo.aod);

  const factores: Record<Factor, number> = {
    viento: notaViento(tiempo, toleranciaViento),
    oleaje: notaOleaje(tiempo, playa?.resguardada ?? false, plan),
    uv: notaUv(tiempo.uv, plan),
    nubosidad: notaNubosidad(tiempo.nubosidad),
    calima: 1 - calima,
  };

  // A quien es sensible la calima le pesa el doble; se renormaliza para que sume 1.
  const pesos = { ...PESOS[plan] };
  if (sensibleCalima) pesos.calima *= 2;
  const sumaPesos = Object.values(pesos).reduce((suma, peso) => suma + peso, 0);

  let nota = 0;
  for (const factor of Object.keys(factores) as Factor[]) {
    nota += (factores[factor] * pesos[factor]) / sumaPesos;
  }

  const apta = plan === 'bano' || playa == null || playa[plan];
  if (!apta) nota *= PENALIZACION_NO_APTA[plan];

  let total = Math.round(limitar(nota) * 100);
  if (sensibleCalima && nivelCalima(calima) === 'fuerte') {
    total = Math.min(total, TOPE_CALIMA_SENSIBLE);
  }

  return { total, factores };
}

export type NivelPuntuacion = 'excelente' | 'bueno' | 'regular' | 'malo';

/** Tramo de la puntuación; da el color y la palabra que la acompañan. */
export function nivelPuntuacion(total: number): NivelPuntuacion {
  if (total >= 80) return 'excelente';
  if (total >= 60) return 'bueno';
  if (total >= 40) return 'regular';
  return 'malo';
}

export interface Franja {
  /** Hora local de inicio y de fin (sin incluir), de 0 a 24. */
  desde: number;
  hasta: number;
  /** Puntuación media de la franja. */
  media: number;
}

/** Horas de luz en las que tiene sentido recomendar ir a la playa. */
const PRIMERA_HORA_UTIL = 8;
const ULTIMA_HORA_UTIL = 20;
const HORAS_DE_FRANJA = 3;

/**
 * Mejor franja del día para ir: el tramo de tres horas seguidas, dentro del horario de
 * luz, con la puntuación media más alta. `puntuaciones` lleva una nota por hora del día,
 * con la hora local (0-23) de cada una. A igualdad, gana la franja más temprana.
 * Devuelve `null` si no hay tres horas útiles seguidas.
 */
export function mejorFranja(puntuaciones: { hora: number; total: number }[]): Franja | null {
  const utiles = puntuaciones
    .filter(({ hora }) => hora >= PRIMERA_HORA_UTIL && hora < ULTIMA_HORA_UTIL)
    .sort((a, b) => a.hora - b.hora);

  let mejor: Franja | null = null;
  for (let i = 0; i + HORAS_DE_FRANJA <= utiles.length; i++) {
    const tramo = utiles.slice(i, i + HORAS_DE_FRANJA);
    // Solo cuentan tramos de horas consecutivas, sin huecos en los datos.
    if (tramo[HORAS_DE_FRANJA - 1].hora - tramo[0].hora !== HORAS_DE_FRANJA - 1) continue;
    const media = tramo.reduce((suma, { total }) => suma + total, 0) / HORAS_DE_FRANJA;
    if (!mejor || media > mejor.media) {
      mejor = {
        desde: tramo[0].hora,
        hasta: tramo[0].hora + HORAS_DE_FRANJA,
        media: Math.round(media),
      };
    }
  }
  return mejor;
}

// ---------------------------------------------------------------------------
// Senderismo
// ---------------------------------------------------------------------------

/** Lo que la puntuación de monte necesita saber del tiempo. */
export interface DatosMonte {
  viento: number;
  rachas: number;
  /** Sensación térmica, °C. */
  sensacion: number;
  /** Lluvia en la hora, mm. */
  lluvia: number;
  /** Probabilidad de lluvia, %. */
  probLluvia: number;
  /** % de nubes bajas. */
  nubesBajas: number;
  /** Visibilidad en metros. */
  visibilidad: number | null;
  uv: number;
  polvo: number | null;
  aod: number | null;
}

export type FactorMonte = 'lluvia' | 'viento' | 'temperatura' | 'visibilidad' | 'uv' | 'calima';

export interface PuntuacionMonte {
  total: number;
  factores: Record<FactorMonte, number>;
}

/** Pesos para senderismo. Suman 1. La lluvia manda: con el suelo mojado no se disfruta. */
export const PESOS_MONTE: Record<FactorMonte, number> = {
  lluvia: 0.3,
  viento: 0.2,
  temperatura: 0.2,
  visibilidad: 0.1,
  uv: 0.1,
  calima: 0.1,
};

/** En el monte se tolera algo más de viento que tumbado en la arena. */
const VIENTO_COMODO_MONTE: Record<ToleranciaViento, number> = { baja: 15, media: 25, alta: 35 };

/**
 * Puntuación de 0 a 100 de un día de senderismo. Misma idea que la de playa: una nota de
 * 0 a 1 por factor y una media ponderada.
 *  - Lluvia: lo peor de lo que cae (0 a 3 mm/h) y de lo probable que es que caiga.
 *  - Viento: como en la playa, con las rachas pesando más porque en una cresta se notan.
 *  - Temperatura: sensación ideal entre 12 y 22 °C; baja hacia 0 °C y hacia 34 °C.
 *  - Visibilidad: las nubes bajas (el mar de nubes por dentro) y la niebla tapan el camino.
 */
export function puntuarSenderismo(
  tiempo: DatosMonte,
  preferencias: Pick<Preferencias, 'toleranciaViento' | 'sensibleCalima'>,
): PuntuacionMonte {
  const calima = intensidadCalima(tiempo.polvo, tiempo.aod);
  const comodo = VIENTO_COMODO_MONTE[preferencias.toleranciaViento];
  const vientoEfectivo = tiempo.viento * 0.6 + tiempo.rachas * 0.4;
  const porNubes = 1 - 0.8 * rampa(tiempo.nubesBajas, 40, 100);
  const conNiebla = tiempo.visibilidad != null && tiempo.visibilidad < 1000;

  const factores: Record<FactorMonte, number> = {
    lluvia: 1 - Math.max(rampa(tiempo.lluvia, 0, 3), 0.8 * rampa(tiempo.probLluvia, 30, 90)),
    viento: notaDecreciente(vientoEfectivo, comodo * 0.25, comodo, comodo + 30),
    temperatura:
      tiempo.sensacion < 12 ? rampa(tiempo.sensacion, 0, 12) : 1 - rampa(tiempo.sensacion, 22, 34),
    visibilidad: conNiebla ? porNubes * 0.5 : porNubes,
    uv: 1 - 0.7 * rampa(tiempo.uv, 6, 11),
    calima: 1 - calima,
  };

  const pesos = { ...PESOS_MONTE };
  if (preferencias.sensibleCalima) pesos.calima *= 2;
  const sumaPesos = Object.values(pesos).reduce((suma, peso) => suma + peso, 0);

  let nota = 0;
  for (const factor of Object.keys(factores) as FactorMonte[]) {
    nota += (factores[factor] * pesos[factor]) / sumaPesos;
  }

  let total = Math.round(limitar(nota) * 100);
  if (preferencias.sensibleCalima && nivelCalima(calima) === 'fuerte') {
    total = Math.min(total, TOPE_CALIMA_SENSIBLE);
  }
  return { total, factores };
}
