import type { NombreIcono } from '@/components/icono';
import type { Caracteristicas, TipoPlaya, Zona } from '@/data/playas';

export const etiquetaZona: Record<Zona, string> = {
  norte: 'Norte',
  sur: 'Sur',
  este: 'Este',
  oeste: 'Oeste',
};

export const etiquetaTipo: Record<TipoPlaya, string> = {
  arena: 'Arena',
  callaos: 'Callaos',
  'piscina-natural': 'Piscina natural',
};

export const infoCaracteristica: Record<
  keyof Caracteristicas,
  { etiqueta: string; icono: NombreIcono }
> = {
  ninos: { etiqueta: 'Apta para niños', icono: 'ninos' },
  surf: { etiqueta: 'Surf', icono: 'surf' },
  snorkel: { etiqueta: 'Snorkel', icono: 'snorkel' },
  socorrista: { etiqueta: 'Socorrista', icono: 'socorrista' },
  resguardada: { etiqueta: 'Resguardada del mar abierto', icono: 'resguardada' },
};

const formatoFecha = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "viernes, 9 de octubre" */
export function fechaLarga(fecha: Date): string {
  return formatoFecha.format(fecha);
}
