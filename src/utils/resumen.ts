import type { Medicion } from '@/api/open-meteo';
import { olaEfectiva, type NivelPuntuacion, type Plan } from '@/scoring/puntuacion';

/** 1,2 en vez de 1.2 */
export function decimal(valor: number, cifras = 1): string {
  return valor.toFixed(cifras).replace('.', ',');
}

export function estadoViento(viento: number): string {
  if (viento < 12) return 'Poco viento';
  if (viento < 25) return 'Brisa';
  if (viento < 40) return 'Viento fuerte';
  return 'Mucho viento';
}

/** Estado del mar en la orilla de la playa, con la ola ya atenuada si está resguardada. */
export function estadoMar(alturaOrilla: number | null): string {
  if (alturaOrilla == null) return 'Mar sin datos';
  if (alturaOrilla < 0.5) return 'Mar en calma';
  if (alturaOrilla < 1.25) return 'Algo de oleaje';
  if (alturaOrilla < 2.5) return 'Mar movido';
  return 'Mar fuerte';
}

function estadoCielo(nubosidad: number, esDeDia: boolean): string {
  if (nubosidad < 25) return esDeDia ? 'sol' : 'cielo despejado';
  if (nubosidad < 65) return 'nubes y claros';
  return 'cielo nublado';
}

/** "Mar en calma, sol y poco viento" */
export function resumen(medicion: Medicion, resguardada: boolean, esDeDia: boolean): string {
  const mar = estadoMar(olaEfectiva(medicion.olaAltura, resguardada));
  const cielo = estadoCielo(medicion.nubosidad, esDeDia);
  return `${mar}, ${cielo} y ${estadoViento(medicion.viento).toLowerCase()}`;
}

const PUNTOS_CARDINALES = [
  'norte',
  'noreste',
  'este',
  'sureste',
  'sur',
  'suroeste',
  'oeste',
  'noroeste',
];

/** De dónde sopla: 324° -> "noroeste" */
export function puntoCardinal(grados: number): string {
  return PUNTOS_CARDINALES[Math.round((((grados % 360) + 360) % 360) / 45) % 8];
}

export const etiquetaNivel: Record<NivelPuntuacion, string> = {
  excelente: 'Excelente',
  bueno: 'Buena',
  regular: 'Regular',
  malo: 'Mala',
};

export const etiquetaPlan: Record<Plan, string> = {
  bano: 'Baño tranquilo',
  surf: 'Surf',
  ninos: 'Con niños',
  snorkel: 'Snorkel',
};

/** "10:30" a partir de una marca de tiempo. */
export function horaCorta(marca: number): string {
  const fecha = new Date(marca);
  return `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

/** "Seco, 17 °C y poco viento" para una ruta de monte. */
export function resumenMonte(medicion: Medicion): string {
  const cielo =
    medicion.lluvia > 0.2
      ? 'Lluvia'
      : medicion.probLluvia >= 50
        ? 'Puede llover'
        : medicion.nubesBajas >= 70
          ? 'Nubes bajas'
          : 'Seco';
  return `${cielo}, ${Math.round(medicion.sensacion)} °C de sensación y ${estadoViento(medicion.viento).toLowerCase()}`;
}
