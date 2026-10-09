import type { NivelCalima } from '@/scoring/puntuacion';

export type FaseDia = 'amanecer' | 'dia' | 'atardecer' | 'noche';
export type Astro = 'sol' | 'sol-velado' | 'sol-calima' | 'luna';
export type Degradado = readonly [string, string, string];

export interface Cielo {
  /** Degradado de arriba abajo. */
  colores: Degradado;
  astro: Astro;
}

const SALIDA_SOL = 7;
const PUESTA_SOL = 20;

/** Fase de luz a partir de la hora local en decimal (14.5 = 14:30). */
export function faseDelDia(hora: number): FaseDia {
  if (hora >= 6.5 && hora < 9) return 'amanecer';
  if (hora >= 9 && hora < 18.5) return 'dia';
  if (hora >= 18.5 && hora < 20.5) return 'atardecer';
  return 'noche';
}

/** Recorrido del sol: 0 al salir, 0.5 en lo más alto, 1 al ponerse. `null` si es de noche. */
export function progresoSolar(hora: number): number | null {
  if (hora < SALIDA_SOL || hora > PUESTA_SOL) return null;
  return (hora - SALIDA_SOL) / (PUESTA_SOL - SALIDA_SOL);
}

// En todos los degradados el tramo superior es oscuro, para que el titular en blanco
// mantenga contraste a cualquier hora y con cualquier tiempo.
const DESPEJADO: Record<FaseDia, Degradado> = {
  amanecer: ['#1F3A63', '#75598A', '#F2A66B'],
  dia: ['#073B5C', '#0F6A98', '#8FD3E3'],
  atardecer: ['#2A2752', '#A84A69', '#F6B45A'],
  noche: ['#040C14', '#0A2233', '#14405A'],
};
const NUBLADO: Degradado = ['#2C4152', '#56717F', '#B5C5CB'];
const CALIMA_LIGERA: Degradado = ['#3B4A52', '#8A7A5C', '#E3CDA0'];
const CALIMA_FUERTE: Degradado = ['#54402A', '#8E6A3E', '#E6C58C'];

/** Umbral de nubosidad media (%) a partir del cual el cielo se pinta cubierto. */
const NUBOSIDAD_CUBIERTO = 70;

/**
 * Cielo de la cabecera a partir de la hora y del tiempo real.
 * De noche manda la hora; de día, la calima gana a las nubes y las nubes al sol.
 */
export function cieloDe(hora: number, nubosidad = 0, calima: NivelCalima = 'ninguna'): Cielo {
  const fase = faseDelDia(hora);
  if (fase === 'noche') return { colores: DESPEJADO.noche, astro: 'luna' };
  if (calima !== 'ninguna') {
    return {
      colores: calima === 'fuerte' ? CALIMA_FUERTE : CALIMA_LIGERA,
      astro: 'sol-calima',
    };
  }
  if (nubosidad >= NUBOSIDAD_CUBIERTO) return { colores: NUBLADO, astro: 'sol-velado' };
  return { colores: DESPEJADO[fase], astro: 'sol' };
}

export function horaDecimal(fecha: Date): number {
  return fecha.getHours() + fecha.getMinutes() / 60;
}
